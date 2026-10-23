"""Shared fixtures: a controllable local HTTP server and a configured test app.

SSRF tests never touch real internal systems: they use mock resolvers, and the only
network peer is the local fixture server below, which is explicitly allowlisted for
tests via ``DestinationPolicy(extra_allowed_networks=["127.0.0.1/32"])``.
"""

from __future__ import annotations

import random
import threading
import time
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.url_policy import DestinationPolicy
from app.main import create_app

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 2048
JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"\x11" * 4096
PDF_BYTES = b"%PDF-1.7\n" + b"0" * 5000
BIG_BODY = b"A" * (3 * 1024 * 1024)
WEB_HEADERS = {"X-UD-Client": "web"}


class FixtureHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    flaky_hits: dict[str, int] = {}
    # Range headers received per path, so tests can see segmenting and resuming.
    range_log: dict[str, list[str]] = {}
    etag = '"v1"'

    def log_message(self, *args: object) -> None:  # silence test output
        pass

    def _send(self, status: int, body: bytes, headers: dict[str, str] | None = None) -> None:
        self.send_response(status)
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        if "Content-Length" not in (headers or {}):
            self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _ranged(self, body: bytes, content_type: str, extra: dict[str, str] | None = None) -> None:
        range_header = self.headers.get("Range")
        headers = {"Content-Type": content_type, "Accept-Ranges": "bytes", **(extra or {})}
        if range_header and range_header.startswith("bytes="):
            start_s, _, end_s = range_header[6:].partition("-")
            start = int(start_s)
            end = min(int(end_s), len(body) - 1) if end_s else len(body) - 1
            headers["Content-Range"] = f"bytes {start}-{end}/{len(body)}"
            self._send(206, body[start : end + 1], headers)
        else:
            self._send(200, body, headers)

    def do_GET(self) -> None:  # noqa: C901, N802
        path = self.path.split("?", 1)[0]
        if path == "/image.png":
            self._ranged(PNG_BYTES, "image/png")
        elif path == "/photo.png":  # misleading extension: the bytes are JPEG
            self._send(200, JPEG_BYTES, {"Content-Type": "application/octet-stream"})
        elif path == "/report":
            self._send(
                200,
                PDF_BYTES,
                {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": 'attachment; filename="../../etc/report.pdf"',
                },
            )
        elif path == "/nolength.txt":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(b"hello without length\n" * 50)
            self.close_connection = True
        elif path == "/page.html":
            self._send(
                200, b"<!doctype html><html><body>hi</body></html>", {"Content-Type": "text/html"}
            )
        elif path == "/big.bin":
            self._ranged(BIG_BODY, "application/octet-stream")
        elif path == "/big-unknown":
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Connection", "close")
            self.end_headers()
            for _ in range(48):
                self.wfile.write(b"B" * 65536)
            self.close_connection = True
        elif path == "/truncated":
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", "100000")
            self.end_headers()
            self.wfile.write(b"x" * 1000)
            self.wfile.flush()
            self.close_connection = True
        elif path == "/flaky.bin":
            hits = FixtureHandler.flaky_hits.get(path, 0)
            FixtureHandler.flaky_hits[path] = hits + 1
            if hits == 0 and not self.headers.get("Range"):
                self.send_response(200)
                self.send_header("Content-Type", "application/zip")
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Length", str(len(ZIP_BODY)))
                self.end_headers()
                self.wfile.write(ZIP_BODY[:30000])
                self.wfile.flush()
                self.close_connection = True
            else:
                self._ranged(ZIP_BODY, "application/zip")
        elif path == "/slow.bin":
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(1024 * 200))
            self.end_headers()
            try:
                for _ in range(200):
                    self.wfile.write(b"s" * 1024)
                    self.wfile.flush()
                    time.sleep(0.05)
            except (BrokenPipeError, ConnectionResetError):
                pass
        elif path in ("/medium.bin", "/flaky-ranged.bin", "/slow-ranged.bin"):
            range_header = self.headers.get("Range", "")
            FixtureHandler.range_log.setdefault(path, []).append(range_header)
            body = MEDIUM_BODY if path != "/slow-ranged.bin" else SLOW_BODY
            if_range = self.headers.get("If-Range")
            if if_range and if_range != FixtureHandler.etag:
                range_header = ""  # file changed: RFC 9110 says send the whole new file
            start, end = 0, len(body) - 1
            status = 200
            if range_header.startswith("bytes="):
                start_s, _, end_s = range_header[6:].partition("-")
                start = int(start_s)
                end = min(int(end_s), len(body) - 1) if end_s else len(body) - 1
                status = 206
            self.send_response(status)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("ETag", FixtureHandler.etag)
            self.send_header("Content-Length", str(end - start + 1))
            if status == 206:
                self.send_header("Content-Range", f"bytes {start}-{end}/{len(body)}")
            self.end_headers()
            payload = body[start : end + 1]
            try:
                if path == "/flaky-ranged.bin" and start > 0:
                    key = f"{path}:{end}"  # the segment's end stays fixed across retries
                    hits = FixtureHandler.flaky_hits.get(key, 0)
                    FixtureHandler.flaky_hits[key] = hits + 1
                    if hits == 0:  # drop each non-first segment once, half way through
                        self.wfile.write(payload[: len(payload) // 2])
                        self.wfile.flush()
                        self.close_connection = True
                        return
                if path == "/slow-ranged.bin":
                    for offset in range(0, len(payload), 4096):
                        self.wfile.write(payload[offset : offset + 4096])
                        self.wfile.flush()
                        time.sleep(0.08)
                else:
                    self.wfile.write(payload)
            except (BrokenPipeError, ConnectionResetError):
                pass
        elif path == "/gallery.html":
            self._send(200, GALLERY_HTML, {"Content-Type": "text/html; charset=utf-8"})
        elif path == "/redirect-safe":
            self._send(302, b"", {"Location": "/image.png"})
        elif path == "/redirect-internal":
            self._send(302, b"", {"Location": "http://10.0.0.5/secret"})
        elif path == "/redirect-metadata":
            self._send(301, b"", {"Location": "http://169.254.169.254/latest/meta-data/"})
        elif path == "/redirect-loopback-alias":
            self._send(302, b"", {"Location": "http://127.0.0.2/"})
        elif path == "/redirect-loop":
            self._send(302, b"", {"Location": "/redirect-loop"})
        elif path == "/missing":
            self._send(404, b"not found", {"Content-Type": "text/plain"})
        else:
            self._send(404, b"", {})


ZIP_BODY = b"PK\x03\x04" + bytes(range(256)) * 400
MEDIUM_BODY = b"PK\x03\x04" + random.Random(7).randbytes(1_500_000)
SLOW_BODY = random.Random(8).randbytes(400_000)
GALLERY_HTML = b"""<!doctype html><html><head>
<base href="/files/">
<meta property="og:image" content="https://cdn.example.com/cover.jpg">
</head><body>
<a href="report.pdf">Annual report</a>
<a href="/about">About us</a>
<a href="https://example.com/archive.zip" title="All files">zip</a>
<a href="javascript:alert(1)">bad.zip</a>
<a href="report.pdf">duplicate</a>
<img src="photo.png" alt="A photo" srcset="photo-2x.png 2x, photo-3x.png 3x">
<a href="/gallery/full.jpg"><img src="/gallery/thumb.jpg"></a>
<video poster="poster.jpg"><source src="clip.mp4" type="video/mp4"></video>
<audio src="/stream/song"></audio>
<a href="live/playlist.m3u8">Live</a>
<a href="data:text/plain,hi.txt">data</a>
</body></html>"""


@pytest.fixture(scope="session")
def fixture_server() -> Iterator[str]:
    server = ThreadingHTTPServer(("127.0.0.1", 0), FixtureHandler)
    server.daemon_threads = True
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        app_env="test",
        database_url=f"sqlite:///{tmp_path / 'app.db'}",
        download_dir=tmp_path / "downloads",
        temp_dir=tmp_path / "tmp",
        max_file_size_mb=2,
        max_storage_mb=50,
        max_concurrent_jobs=2,
        max_connections_per_download=4,
        min_segment_size_kb=64,
        job_timeout_seconds=60,
        connect_timeout_seconds=2,
        read_timeout_seconds=2,
        rate_limit_per_minute=1000,
        ytdlp_enabled=False,
        allowed_origins=["http://localhost:3000"],
        auth_required=False,
        _env_file=None,
    )


@pytest.fixture
def test_policy() -> DestinationPolicy:
    return DestinationPolicy(extra_allowed_networks=["127.0.0.1/32"])


@pytest.fixture
def client(settings: Settings, test_policy: DestinationPolicy) -> Iterator[TestClient]:
    app = create_app(settings, policy=test_policy)
    with TestClient(app, headers=WEB_HEADERS) as test_client:
        yield test_client


def wait_for_terminal(client: TestClient, job_id: str, timeout: float = 15) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        job = client.get(f"/api/v1/downloads/{job_id}").json()
        if job["status"] in ("completed", "failed", "cancelled", "expired"):
            return job
        time.sleep(0.05)
    raise AssertionError(f"job {job_id} did not finish: {job}")
