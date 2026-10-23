"""Media job flow with yt-dlp replaced by fakes (no external sites are contacted)."""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.services import inspection, media
from app.workers import runner
from tests.conftest import wait_for_terminal

FIXTURE = json.loads((Path(__file__).parent.parent / "fixtures" / "ytdlp_video.json").read_text())
MEDIA_URL = "https://video.example.com/watch?v=fixture"


@pytest.fixture
def fake_media(monkeypatch: pytest.MonkeyPatch, client: TestClient) -> dict:
    calls: dict = {"selectors": []}

    async def fake_resolve(host: str, port: int) -> list[str]:
        return ["93.184.215.14"]

    client.app.state.ctx.policy._resolver = fake_resolve
    client.app.state.ctx.settings.ytdlp_enabled = True

    async def fake_inspect(url: str, timeout: float, ffmpeg: str | None) -> media.MediaInfo:
        return media.parse_media_info(FIXTURE, ffmpeg_available=ffmpeg is not None)

    async def fake_download(url, selector, output_dir, *, max_bytes, ffmpeg, on_progress):
        calls["selectors"].append(selector)
        await on_progress(50, 100)
        out = output_dir / "media.mp4"
        out.write_bytes(b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 100)
        await on_progress(out.stat().st_size, out.stat().st_size)
        return media.MediaResult(path=out, size=out.stat().st_size, ext=".mp4")

    monkeypatch.setattr(inspection.media, "dedicated_extractor", lambda url: "Fixture")
    monkeypatch.setattr(media, "inspect_media", fake_inspect)
    monkeypatch.setattr(media, "download_media", fake_download)
    monkeypatch.setattr(media, "ffmpeg_path", lambda configured: "/usr/bin/ffmpeg")
    assert runner.media is media
    return calls


def test_inspect_media_lists_real_formats(client: TestClient, fake_media: dict) -> None:
    body = client.post("/api/v1/inspect", json={"url": MEDIA_URL}).json()
    assert body["kind"] == "media"
    assert body["media"]["title"] == "Fixture video"
    assert [f["format_id"] for f in body["media"]["formats"]] == ["18", "137", "248", "140", "251"]
    assert body["media"]["ffmpeg_available"] is True


def test_media_download_merges_audio_for_video_only(client: TestClient, fake_media: dict) -> None:
    job = client.post(
        "/api/v1/downloads",
        json={"url": MEDIA_URL, "mode": "media", "format_id": "137", "merge_audio": True},
    ).json()
    job = wait_for_terminal(client, job["id"])
    assert job["status"] == "completed", job["error"]
    assert job["filename"] == "Fixture video.mp4"
    assert job["content_type"] == "video/mp4"
    assert fake_media["selectors"] == ["137+bestaudio"]


def test_media_download_combined_format_does_not_merge(
    client: TestClient, fake_media: dict
) -> None:
    job = client.post(
        "/api/v1/downloads",
        json={"url": MEDIA_URL, "mode": "media", "format_id": "18", "merge_audio": True},
    ).json()
    assert wait_for_terminal(client, job["id"])["status"] == "completed"
    assert fake_media["selectors"] == ["18"]


def test_media_download_rejects_unknown_format(client: TestClient, fake_media: dict) -> None:
    job = client.post(
        "/api/v1/downloads", json={"url": MEDIA_URL, "mode": "media", "format_id": "4320p"}
    ).json()
    job = wait_for_terminal(client, job["id"])
    assert job["error"]["code"] == "FORMAT_NOT_AVAILABLE"
