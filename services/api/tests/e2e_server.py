"""Start the API plus a local file server for browser end-to-end tests.

TEST USE ONLY. This is the only place the fixture server's loopback address is
allowlisted, and it is done in code, not through environment variables.

Usage: python -m tests.e2e_server   (from services/api)
"""

from __future__ import annotations

import os
import tempfile
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

import uvicorn

from app.core.config import Settings
from app.core.url_policy import DestinationPolicy
from app.main import create_app
from tests.conftest import FixtureHandler

FIXTURE_PORT = int(os.environ.get("E2E_FIXTURE_PORT", "8765"))
API_PORT = int(os.environ.get("E2E_API_PORT", "8000"))


def main() -> None:
    fixture = ThreadingHTTPServer(("127.0.0.1", FIXTURE_PORT), FixtureHandler)
    threading.Thread(target=fixture.serve_forever, daemon=True).start()

    data = Path(tempfile.mkdtemp(prefix="ud-e2e-"))
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{data / 'app.db'}",
        download_dir=data / "downloads",
        temp_dir=data / "tmp",
        max_file_size_mb=2,
        ytdlp_enabled=False,
        allowed_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        rate_limit_per_minute=1000,
        _env_file=None,
    )
    app = create_app(settings, policy=DestinationPolicy(extra_allowed_networks=["127.0.0.1/32"]))
    uvicorn.run(app, host="127.0.0.1", port=API_PORT, log_level="warning")


if __name__ == "__main__":
    main()
