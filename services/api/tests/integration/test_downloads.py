import time
from datetime import timedelta
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.schemas.models import JobStatus
from app.services.job_store import utcnow
from tests.conftest import JPEG_BYTES, PNG_BYTES, ZIP_BODY, wait_for_terminal


def test_health(client: TestClient) -> None:
    body = client.get("/api/v1/health").json()
    assert body["status"] == "ok"
    assert set(body["tools"]) == {"yt_dlp", "ffmpeg"}


def test_inspect_file_with_content_length(client: TestClient, fixture_server: str) -> None:
    body = client.post("/api/v1/inspect", json={"url": fixture_server + "/image.png"}).json()
    assert body["kind"] == "file"
    assert body["content_type"] == "image/png"
    assert body["category"] == "image"
    assert body["size_bytes"] == len(PNG_BYTES)
    assert body["filename"] == "image.png"
    assert body["accepts_ranges"] is True
    assert body["downloadable"] is True


def test_inspect_uses_magic_bytes_not_extension(client: TestClient, fixture_server: str) -> None:
    body = client.post("/api/v1/inspect", json={"url": fixture_server + "/photo.png"}).json()
    assert body["content_type"] == "image/jpeg"
    assert body["declared_content_type"] == "application/octet-stream"


def test_inspect_without_content_length(client: TestClient, fixture_server: str) -> None:
    body = client.post("/api/v1/inspect", json={"url": fixture_server + "/nolength.txt"}).json()
    assert body["size_bytes"] is None
    assert "SIZE_UNKNOWN" in body["warnings"]
    assert body["category"] == "document"


def test_inspect_follows_safe_redirects(client: TestClient, fixture_server: str) -> None:
    body = client.post("/api/v1/inspect", json={"url": fixture_server + "/redirect-safe"}).json()
    assert body["final_url"].endswith("/image.png")
    assert len(body["redirect_chain"]) == 1


def test_inspect_rejects_unsafe_redirect(client: TestClient, fixture_server: str) -> None:
    response = client.post("/api/v1/inspect", json={"url": fixture_server + "/redirect-internal"})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "BLOCKED_DESTINATION"


def test_inspect_webpage_is_not_downloadable(client: TestClient, fixture_server: str) -> None:
    body = client.post("/api/v1/inspect", json={"url": fixture_server + "/page.html"}).json()
    assert body["kind"] == "webpage"
    assert body["downloadable"] is False


def test_inspect_large_file_flagged(client: TestClient, fixture_server: str) -> None:
    body = client.post("/api/v1/inspect", json={"url": fixture_server + "/big.bin"}).json()
    assert body["downloadable"] is False
    assert "FILE_TOO_LARGE" in body["warnings"]


def test_inspect_source_error(client: TestClient, fixture_server: str) -> None:
    response = client.post("/api/v1/inspect", json={"url": fixture_server + "/missing"})
    assert response.json()["error"]["code"] == "SOURCE_UNAVAILABLE"


def test_download_with_content_length(client: TestClient, fixture_server: str) -> None:
    created = client.post("/api/v1/downloads", json={"url": fixture_server + "/image.png"})
    assert created.status_code == 202
    assert created.json()["status"] == "queued"
    job = wait_for_terminal(client, created.json()["id"])
    assert job["status"] == "completed"
    assert job["actual_size"] == len(PNG_BYTES)
    assert job["progress"] == 1.0
    assert job["download_available"] is True
    file_response = client.get(f"/api/v1/downloads/{job['id']}/file")
    assert file_response.content == PNG_BYTES
    assert file_response.headers["content-disposition"].startswith("attachment")
    assert file_response.headers["x-content-type-options"] == "nosniff"


def test_download_supports_range_requests_on_result(
    client: TestClient, fixture_server: str
) -> None:
    job = client.post("/api/v1/downloads", json={"url": fixture_server + "/photo.png"}).json()
    job = wait_for_terminal(client, job["id"])
    assert job["content_type"] == "image/jpeg"
    partial = client.get(f"/api/v1/downloads/{job['id']}/file", headers={"Range": "bytes=0-3"})
    assert partial.status_code == 206
    assert partial.content == JPEG_BYTES[:4]


def test_download_without_content_length(client: TestClient, fixture_server: str) -> None:
    job = client.post("/api/v1/downloads", json={"url": fixture_server + "/nolength.txt"}).json()
    job = wait_for_terminal(client, job["id"])
    assert job["status"] == "completed"
    assert job["actual_size"] == len(b"hello without length\n") * 50


def test_download_of_webpage_is_unsupported(client: TestClient, fixture_server: str) -> None:
    job = client.post("/api/v1/downloads", json={"url": fixture_server + "/page.html"}).json()
    job = wait_for_terminal(client, job["id"])
    assert job["status"] == "failed"
    assert job["error"]["code"] == "UNSUPPORTED_CONTENT"


def test_size_limit_with_content_length(
    client: TestClient, fixture_server: str, settings: Settings
) -> None:
    job = client.post("/api/v1/downloads", json={"url": fixture_server + "/big.bin"}).json()
    job = wait_for_terminal(client, job["id"])
    assert job["error"]["code"] == "FILE_TOO_LARGE"
    assert not any(Path(settings.temp_dir).iterdir())


def test_size_limit_without_content_length(
    client: TestClient, fixture_server: str, settings: Settings
) -> None:
    job = client.post("/api/v1/downloads", json={"url": fixture_server + "/big-unknown"}).json()
    job = wait_for_terminal(client, job["id"])
    assert job["error"]["code"] == "FILE_TOO_LARGE"
    assert not any(Path(settings.temp_dir).iterdir())
    assert not any(p.is_file() for p in Path(settings.download_dir).rglob("*"))


def test_truncated_download_fails(
    client: TestClient, fixture_server: str, settings: Settings
) -> None:
    job = client.post("/api/v1/downloads", json={"url": fixture_server + "/truncated"}).json()
    job = wait_for_terminal(client, job["id"])
    assert job["status"] == "failed"
    assert job["error"]["code"] == "INCOMPLETE_DOWNLOAD"
    assert client.get(f"/api/v1/downloads/{job['id']}/file").status_code == 409
    assert not any(Path(settings.temp_dir).iterdir())


def test_interrupted_download_resumes_with_range(client: TestClient, fixture_server: str) -> None:
    job = client.post("/api/v1/downloads", json={"url": fixture_server + "/flaky.bin"}).json()
    job = wait_for_terminal(client, job["id"])
    assert job["status"] == "completed", job["error"]
    assert client.get(f"/api/v1/downloads/{job['id']}/file").content == ZIP_BODY
    assert job["category"] == "archive"


def test_cancel_running_job(client: TestClient, fixture_server: str, settings: Settings) -> None:
    job = client.post("/api/v1/downloads", json={"url": fixture_server + "/slow.bin"}).json()
    deadline = time.monotonic() + 5
    while client.get(f"/api/v1/downloads/{job['id']}").json()["status"] != "downloading":
        assert time.monotonic() < deadline
        time.sleep(0.05)
    cancelled = client.post(f"/api/v1/downloads/{job['id']}/cancel")
    assert cancelled.status_code == 200
    job = wait_for_terminal(client, job["id"])
    assert job["status"] == "cancelled"
    assert not any(Path(settings.temp_dir).iterdir())
    again = client.post(f"/api/v1/downloads/{job['id']}/cancel")
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "INVALID_STATE"


def test_job_timeout(client: TestClient, fixture_server: str) -> None:
    client.app.state.ctx.settings.job_timeout_seconds = 1
    job = client.post("/api/v1/downloads", json={"url": fixture_server + "/slow.bin"}).json()
    job = wait_for_terminal(client, job["id"])
    assert job["error"]["code"] == "DOWNLOAD_TIMEOUT"


def test_expired_files_are_cleaned_up(
    client: TestClient, fixture_server: str, settings: Settings
) -> None:
    job = client.post("/api/v1/downloads", json={"url": fixture_server + "/image.png"}).json()
    wait_for_terminal(client, job["id"])
    ctx = client.app.state.ctx
    ctx.store.update(
        job["id"], finished_at=utcnow() - timedelta(hours=settings.temp_file_ttl_hours + 1)
    )
    assert ctx.runner.cleanup_once() == 1
    assert ctx.store.get(job["id"]).status == JobStatus.EXPIRED
    assert not (Path(settings.download_dir) / job["id"]).exists()
    response = client.get(f"/api/v1/downloads/{job['id']}/file")
    assert response.status_code == 409


def test_stale_temp_files_are_removed(client: TestClient, settings: Settings) -> None:
    stale = Path(settings.temp_dir) / ("f" * 32 + ".part")
    stale.write_bytes(b"x")
    old = time.time() - settings.temp_file_ttl_hours * 3600 - 10
    import os

    os.utime(stale, (old, old))
    client.app.state.ctx.runner.cleanup_once()
    assert not stale.exists()


def test_per_owner_active_job_quota(client: TestClient, fixture_server: str) -> None:
    client.app.state.ctx.settings.max_active_jobs_per_owner = 1
    first = client.post("/api/v1/downloads", json={"url": fixture_server + "/slow.bin"})
    second = client.post("/api/v1/downloads", json={"url": fixture_server + "/image.png"})
    assert first.status_code == 202
    assert second.status_code == 429
    assert second.json()["error"]["code"] == "QUOTA_EXCEEDED"
    client.post(f"/api/v1/downloads/{first.json()['id']}/cancel")


def test_media_mode_requires_format(client: TestClient, fixture_server: str) -> None:
    response = client.post(
        "/api/v1/downloads", json={"url": fixture_server + "/image.png", "mode": "media"}
    )
    assert response.json()["error"]["code"] == "FORMAT_NOT_AVAILABLE"


def test_list_downloads(client: TestClient, fixture_server: str) -> None:
    job = client.post("/api/v1/downloads", json={"url": fixture_server + "/image.png"}).json()
    wait_for_terminal(client, job["id"])
    items = client.get("/api/v1/downloads").json()["items"]
    assert [item["id"] for item in items] == [job["id"]]
    assert items[0]["source_host"] == "127.0.0.1"


def test_filename_is_known_while_downloading(client: TestClient, fixture_server: str) -> None:
    job = client.post("/api/v1/downloads", json={"url": fixture_server + "/slow.bin"}).json()
    deadline = time.monotonic() + 5
    while True:
        current = client.get(f"/api/v1/downloads/{job['id']}").json()
        if current["status"] == "downloading" and current["filename"]:
            break
        assert time.monotonic() < deadline
        time.sleep(0.05)
    assert current["filename"] == "slow.bin"
    client.post(f"/api/v1/downloads/{job['id']}/cancel")
    wait_for_terminal(client, job["id"])
