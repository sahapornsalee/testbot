# Universal Downloader API

FastAPI service: URL inspection with SSRF protection, direct streaming downloads, yt-dlp/FFmpeg
media downloads, SQLite job store and an in-process job runner.

```bash
python -m venv .venv
.venv/bin/pip install -e ".[dev]"          # Windows: .\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.venv/bin/uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
.venv/bin/pytest                           # unit + integration + security
.venv/bin/ruff check . && .venv/bin/ruff format --check .
```

Configuration is read from environment variables, `services/api/.env` or the repository root
`.env` (see `../../.env.example`). Relative paths (`./data/...`) resolve from the directory you
start the server in.

Layout: `app/api` (routes), `app/core` (config, errors, URL policy, request security, logging),
`app/schemas` (Pydantic models), `app/services` (HTTP client, inspection, downloads, media, storage,
job store), `app/workers` (job runner). See `../../docs/ARCHITECTURE.md` and `../../docs/API.md`.
