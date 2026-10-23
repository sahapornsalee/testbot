"""Segmented downloads, pause/resume, batch queueing and the page grabber."""

import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.url_policy import DestinationPolicy
from app.main import create_app
from app.schemas.models import DownloadMode, JobStatus
from app.services.job_store import JobRecord, JobStore
from tests.conftest import MEDIUM_BODY, SLOW_BODY, WEB_HEADERS, FixtureHandler, wait_for_terminal


@pytest.fixture(autouse=True)
def reset_fixture_state():
    FixtureHandler.range_log.clear()
    FixtureHandler.flaky_hits.clear()
    FixtureHandler.etag = '"v1"'
    yield
    FixtureHandler.etag = '"v1"'


def wait_for(client: TestClient, job_id: str, predicate, timeout: float = 10) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        job = client.get(f"/api/v1/downloads/{job_id}").json()
        if predicate(job):
            return job
        time.sleep(0.03)
    raise AssertionError(f"condition not met: {job}")


def test_large_file_uses_parallel_segments(client: TestClient, fixture_server: str) -> None:
    job = client.post("/api/v1/downloads", json={"url": fixture_server + "/medium.bin"}).json()
    job = wait_for_terminal(client, job["id"])
    assert job["status"] == "completed", job["error"]
    assert job["connections"] == 4
    assert client.get(f"/api/v1/downloads/{job['id']}/file").content == MEDIUM_BODY
    segment_ranges = [r for r in FixtureHandler.range_log["/medium.bin"] if r != "bytes=0-"]
    assert len(segment_ranges) == 4
    assert job["category"] == "archive"  # sniffed from the reassembled file


def test_dropped_segment_is_retried(client: TestClient, fixture_server: str) -> None:
    job = client.post(
        "/api/v1/downloads", json={"url": fixture_server + "/flaky-ranged.bin"}
    ).json()
    job = wait_for_terminal(client, job["id"])
    assert job["status"] == "completed", job["error"]
    assert client.get(f"/api/v1/downloads/{job['id']}/file").content == MEDIUM_BODY
    retries = [r for r in FixtureHandler.range_log["/flaky-ranged.bin"] if r != "bytes=0-"]
    assert len(retries) > 4  # three segments needed a second, resumed request


def test_pause_and_resume_continues_where_it_stopped(
    client: TestClient, fixture_server: str, settings: Settings
) -> None:
    job = client.post("/api/v1/downloads", json={"url": fixture_server + "/slow-ranged.bin"}).json()
    wait_for(
        client, job["id"], lambda j: j["status"] == "downloading" and j["downloaded_bytes"] > 50_000
    )
    paused = client.post(f"/api/v1/downloads/{job['id']}/pause").json()
    assert paused["id"] == job["id"]
    job = wait_for(client, job["id"], lambda j: j["status"] == "paused")
    assert job["can_resume"] is True and job["can_pause"] is False
    done_before = job["downloaded_bytes"]
    temp = Path(settings.temp_dir)
    assert (temp / f"{job['id']}.part").exists() and (temp / f"{job['id']}.state.json").exists()

    FixtureHandler.range_log.clear()
    resumed = client.post(f"/api/v1/downloads/{job['id']}/resume")
    assert resumed.status_code == 200
    job = wait_for_terminal(client, job["id"], timeout=20)
    assert job["status"] == "completed", job["error"]
    assert client.get(f"/api/v1/downloads/{job['id']}/file").content == SLOW_BODY
    starts = [
        int(r[6:].split("-")[0])
        for r in FixtureHandler.range_log["/slow-ranged.bin"]
        if r != "bytes=0-"
    ]
    assert starts and min(starts) > 0, "resume must continue from saved offsets, not restart"
    assert done_before > 0
    assert not any(temp.iterdir())


def test_resume_restarts_cleanly_when_file_changed(client: TestClient, fixture_server: str) -> None:
    job = client.post("/api/v1/downloads", json={"url": fixture_server + "/slow-ranged.bin"}).json()
    wait_for(client, job["id"], lambda j: j["downloaded_bytes"] > 50_000)
    client.post(f"/api/v1/downloads/{job['id']}/pause")
    wait_for(client, job["id"], lambda j: j["status"] == "paused")
    FixtureHandler.etag = '"v2"'  # the server-side file changed while paused
    client.post(f"/api/v1/downloads/{job['id']}/resume")
    job = wait_for_terminal(client, job["id"], timeout=20)
    assert job["status"] == "completed", job["error"]
    assert client.get(f"/api/v1/downloads/{job['id']}/file").content == SLOW_BODY


def test_cancel_paused_job_removes_partial_data(
    client: TestClient, fixture_server: str, settings: Settings
) -> None:
    job = client.post("/api/v1/downloads", json={"url": fixture_server + "/slow-ranged.bin"}).json()
    wait_for(client, job["id"], lambda j: j["downloaded_bytes"] > 0)
    client.post(f"/api/v1/downloads/{job['id']}/pause")
    wait_for(client, job["id"], lambda j: j["status"] == "paused")
    cancelled = client.post(f"/api/v1/downloads/{job['id']}/cancel").json()
    assert cancelled["status"] == "cancelled"
    assert not any(Path(settings.temp_dir).iterdir())


def test_pause_and_resume_state_rules(client: TestClient, fixture_server: str) -> None:
    job = client.post("/api/v1/downloads", json={"url": fixture_server + "/image.png"}).json()
    wait_for_terminal(client, job["id"])
    assert (
        client.post(f"/api/v1/downloads/{job['id']}/pause").json()["error"]["code"]
        == "INVALID_STATE"
    )
    assert (
        client.post(f"/api/v1/downloads/{job['id']}/resume").json()["error"]["code"]
        == "INVALID_STATE"
    )


def test_restart_pauses_interrupted_direct_downloads(
    settings: Settings, test_policy: DestinationPolicy
) -> None:
    store = JobStore(settings.sqlite_path)
    for job_id, mode, status in (
        ("a" * 32, DownloadMode.DIRECT, JobStatus.DOWNLOADING),
        ("b" * 32, DownloadMode.MEDIA, JobStatus.DOWNLOADING),
        ("c" * 32, DownloadMode.DIRECT, JobStatus.PROCESSING),
    ):
        store.insert(
            JobRecord(
                id=job_id,
                owner="ses:x",
                status=status,
                mode=mode,
                source_url="https://e.com/f",
                source_host="e.com",
            )
        )
    store.close()
    with TestClient(create_app(settings, policy=test_policy), headers=WEB_HEADERS) as api:
        ctx = api.app.state.ctx
        assert ctx.store.get("a" * 32).status == JobStatus.PAUSED
        assert ctx.store.get("b" * 32).error_code == "INTERRUPTED"
        assert ctx.store.get("c" * 32).error_code == "INTERRUPTED"


def test_old_database_is_migrated(settings: Settings, test_policy: DestinationPolicy) -> None:
    import sqlite3

    path = settings.sqlite_path
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute(
        "CREATE TABLE jobs (id TEXT PRIMARY KEY, owner TEXT NOT NULL, status TEXT NOT NULL, mode TEXT NOT NULL,"
        " source_url TEXT NOT NULL, source_host TEXT NOT NULL, format_id TEXT, merge_audio INTEGER NOT NULL DEFAULT 0,"
        " filename TEXT, category TEXT, content_type TEXT, expected_size INTEGER, actual_size INTEGER,"
        " downloaded_bytes INTEGER NOT NULL DEFAULT 0, file_path TEXT, error_code TEXT, error_message TEXT,"
        " created_at TEXT NOT NULL, started_at TEXT, finished_at TEXT)"
    )
    conn.execute(
        "INSERT INTO jobs (id, owner, status, mode, source_url, source_host, created_at)"
        " VALUES (?, 'ses:x', 'completed', 'direct', 'https://e.com/f', 'e.com', '2026-10-01T00:00:00+00:00')",
        ("d" * 32,),
    )
    conn.commit()
    conn.close()
    store = JobStore(path)
    assert store.get("d" * 32).connections is None  # old rows survive, new columns exist
    store.close()


def test_batch_queues_valid_links_and_reports_bad_ones(
    client: TestClient, fixture_server: str
) -> None:
    response = client.post(
        "/api/v1/downloads/batch",
        json={
            "items": [
                {"url": fixture_server + "/image.png"},
                {"url": "http://169.254.169.254/latest/"},
                {"url": "not a url"},
                {"url": fixture_server + "/report"},
            ]
        },
    )
    assert response.status_code == 202
    body = response.json()
    assert len(body["created"]) == 2
    assert [(e["index"], e["error"]["code"]) for e in body["errors"]] == [
        (1, "BLOCKED_DESTINATION"),
        (2, "INVALID_URL"),
    ]
    for job in body["created"]:
        assert wait_for_terminal(client, job["id"])["status"] == "completed"


def test_batch_size_is_limited(client: TestClient, fixture_server: str) -> None:
    client.app.state.ctx.settings.max_batch_size = 2
    items = [{"url": fixture_server + "/image.png"}] * 3
    response = client.post("/api/v1/downloads/batch", json={"items": items})
    assert response.status_code == 422


def test_inspect_web_page_lists_downloadable_links(client: TestClient, fixture_server: str) -> None:
    body = client.post("/api/v1/inspect", json={"url": fixture_server + "/gallery.html"}).json()
    assert body["kind"] == "webpage"
    urls = {link["url"]: link for link in body["links"]}
    assert urls[fixture_server + "/files/report.pdf"]["label"] == "Annual report"
    assert urls[fixture_server + "/files/clip.mp4"]["category"] == "video"
    assert urls[fixture_server + "/about"]["category"] == "link"
    assert body["download_mode"] == "page"
    assert "SIZE_UNKNOWN" not in body["warnings"]


def test_page_without_files_returns_no_links(client: TestClient, fixture_server: str) -> None:
    body = client.post("/api/v1/inspect", json={"url": fixture_server + "/page.html"}).json()
    assert body["links"] == []
