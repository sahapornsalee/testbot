"""HLS streams, saving a web page, and choosing everything on a page."""

import shutil
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from tests.conftest import GALLERY_HTML, TS_CLIP, FixtureHandler, wait_for_terminal


@pytest.fixture(autouse=True)
def reset_log():
    FixtureHandler.range_log.clear()
    yield


def test_inspect_hls_master_shows_real_qualities(client: TestClient, fixture_server: str) -> None:
    body = client.post("/api/v1/inspect", json={"url": fixture_server + "/hls/master.m3u8"}).json()
    assert body["kind"] == "media"
    assert body["download_mode"] == "hls"
    assert [(f["format_id"], f["height"]) for f in body["media"]["formats"]] == [
        ("v0", 180),
        ("v1", 720),
    ]
    assert body["media"]["best_format_id"] == "v1"


def test_download_hls_best_quality(client: TestClient, fixture_server: str) -> None:
    job = client.post(
        "/api/v1/downloads", json={"url": fixture_server + "/hls/master.m3u8", "mode": "hls"}
    ).json()
    assert job["format_id"] == "best"
    job = wait_for_terminal(client, job["id"])
    assert job["status"] == "completed", job["error"]
    content = client.get(f"/api/v1/downloads/{job['id']}/file").content
    if shutil.which("ffmpeg"):
        assert job["filename"].endswith(".mp4")
        assert content[4:8] == b"ftyp"  # remuxed into a real MP4 container
    else:
        assert content == TS_CLIP
    assert "low0.ts" not in FixtureHandler.range_log["/hls"]  # only the chosen quality


def test_download_hls_selected_quality(client: TestClient, fixture_server: str) -> None:
    job = client.post(
        "/api/v1/downloads",
        json={"url": fixture_server + "/hls/master.m3u8", "mode": "hls", "format_id": "v0"},
    ).json()
    job = wait_for_terminal(client, job["id"])
    assert job["status"] == "completed", job["error"]
    assert "low0.ts" in FixtureHandler.range_log["/hls"]
    assert "seg0.ts" not in FixtureHandler.range_log["/hls"]


def test_download_aes128_stream_is_decrypted(client: TestClient, fixture_server: str) -> None:
    client.app.state.ctx.settings.ffmpeg_location = "/nonexistent/ffmpeg"  # keep raw TS to compare
    job = client.post(
        "/api/v1/downloads", json={"url": fixture_server + "/hls/aes.m3u8", "mode": "hls"}
    ).json()
    job = wait_for_terminal(client, job["id"])
    assert job["status"] == "completed", job["error"]
    assert client.get(f"/api/v1/downloads/{job['id']}/file").content == TS_CLIP
    assert job["filename"].endswith(".ts")


@pytest.mark.parametrize("name", ["live.m3u8", "drm.m3u8"])
def test_live_and_drm_streams_are_refused(
    client: TestClient, fixture_server: str, name: str
) -> None:
    response = client.post("/api/v1/inspect", json={"url": f"{fixture_server}/hls/{name}"})
    assert response.json()["error"]["code"] == "UNSUPPORTED_SOURCE"


def test_hls_pause_resume_skips_finished_segments(
    client: TestClient, fixture_server: str, settings
) -> None:
    job = client.post(
        "/api/v1/downloads", json={"url": fixture_server + "/hls/slow.m3u8", "mode": "hls"}
    ).json()
    deadline = time.monotonic() + 10
    while client.get(f"/api/v1/downloads/{job['id']}").json()["downloaded_bytes"] < 150_000:
        assert time.monotonic() < deadline
        time.sleep(0.05)
    client.post(f"/api/v1/downloads/{job['id']}/pause")
    while client.get(f"/api/v1/downloads/{job['id']}").json()["status"] != "paused":
        assert time.monotonic() < deadline
        time.sleep(0.05)
    done = {
        p.name for p in (Path(settings.temp_dir) / job["id"]).glob("seg_*") if p.suffix != ".tmp"
    }
    assert done
    FixtureHandler.range_log.clear()
    client.post(f"/api/v1/downloads/{job['id']}/resume")
    job = wait_for_terminal(client, job["id"], timeout=20)
    assert job["status"] == "completed", job["error"]
    fetched_again = {n for n in FixtureHandler.range_log["/hls"] if n.startswith("slow-seg")}
    assert len(fetched_again) == 16 - len(done)
    assert job["actual_size"] == 16 * 50_000


def test_save_page_itself(client: TestClient, fixture_server: str) -> None:
    job = client.post(
        "/api/v1/downloads", json={"url": fixture_server + "/gallery.html", "mode": "page"}
    ).json()
    job = wait_for_terminal(client, job["id"])
    assert job["status"] == "completed", job["error"]
    response = client.get(f"/api/v1/downloads/{job['id']}/file")
    assert response.content == GALLERY_HTML
    assert job["filename"] == "gallery.html"
    assert response.headers["content-type"] == "application/octet-stream"  # never rendered inline


def test_direct_mode_still_refuses_html(client: TestClient, fixture_server: str) -> None:
    job = client.post("/api/v1/downloads", json={"url": fixture_server + "/gallery.html"}).json()
    assert wait_for_terminal(client, job["id"])["error"]["code"] == "UNSUPPORTED_CONTENT"


def test_select_everything_beyond_one_batch(client: TestClient, fixture_server: str) -> None:
    """A page with 120 files can be queued completely (the UI sends 50 per request)."""
    items = [{"url": f"{fixture_server}/image.png?n={i}"} for i in range(120)]
    created = 0
    for start in range(0, len(items), 50):
        body = client.post(
            "/api/v1/downloads/batch", json={"items": items[start : start + 50]}
        ).json()
        assert body["errors"] == []
        created += len(body["created"])
    assert created == 120
    client.app.state.ctx.runner  # jobs run in the background; wait for them all
    deadline = time.monotonic() + 30
    while True:
        jobs = client.get("/api/v1/downloads").json()["items"]
        if all(j["status"] == "completed" for j in jobs):
            break
        assert time.monotonic() < deadline
        time.sleep(0.1)
