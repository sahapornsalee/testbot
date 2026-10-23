# Architecture

```
Browser ──► Next.js web (apps/web) ──/api/v1/* rewrite──► FastAPI (services/api)
                                                           │
                         ┌─────────────────────────────────┼─────────────────────────────┐
                         ▼                                 ▼                             ▼
                 URL policy + guarded HTTP         Job runner (in-process)         SQLite job store
                 (app/core/url_policy.py,          (app/workers/runner.py)         (app/services/job_store.py)
                  app/services/safe_http.py)              │
                         ▲                     ┌──────────┴───────────┐
                         │                     ▼                      ▼
                         └──── Direct downloader            Media (yt-dlp/FFmpeg subprocess)
                               (app/services/direct.py)     (app/services/media.py)
                                                │                      │
                                                └──────► Storage ◄─────┘
                                                   (app/services/storage.py:
                                                    TEMP_DIR → DOWNLOAD_DIR/<job_id>/)
```

## Modules

| Path | Responsibility |
|---|---|
| `app/core/config.py` | Settings from env/.env; refuses unsafe production config |
| `app/core/url_policy.py` | URL syntax validation, DNS resolution, public-IP enforcement |
| `app/core/security.py` | Owner identity (session cookie or bearer token), CSRF header/Origin check, rate limiter, body-size limit |
| `app/core/errors.py` | Stable error codes → HTTP status |
| `app/services/safe_http.py` | HTTPX client whose TCP connections go only to validated IPs; manual redirect handling |
| `app/services/file_types.py` | Magic-byte sniffing, MIME resolution, categories, safe filenames |
| `app/services/direct.py` | Header/first-8KB inspection and streaming downloads with limits and Range resume |
| `app/services/media.py` | yt-dlp/FFmpeg detection, metadata parsing, subprocess downloads |
| `app/services/inspection.py` | Chooses media vs. direct inspection and builds the response |
| `app/services/job_store.py` | SQLite persistence and the job state machine |
| `app/services/storage.py` | Path confinement, atomic commit, capacity checks, cleanup |
| `app/workers/runner.py` | Concurrency limit, timeouts, cancellation, retention sweep |
| `app/api/routes.py` | `/api/v1` HTTP routes |
| `apps/web/src/i18n` | Thai/English dictionaries and provider |
| `apps/web/src/features` | Inspect (URL form, result, format picker) and jobs (queue, polling) |

## Job lifecycle

```
queued ─► inspecting ─► downloading ─► processing ─► completed ─► expired
   │           │             │              │
   ├───────────┴──────┬──────┘              │
   │                  ▼                     │
   │               paused ──resume──► queued│      (paused ─► cancelled | expired)
   └────────────────────────────────────────┴──► failed | cancelled
```

## Segmented downloads

`direct.download_direct` first sends `Range: bytes=0-`. If the server answers `206` with a known
size and no content encoding, the file is pre-allocated and split into up to
`MAX_CONNECTIONS_PER_DOWNLOAD` segments (each ≥ `MIN_SEGMENT_SIZE_KB`), fetched in parallel by an
`asyncio.TaskGroup`, each writing at its own offset. Every request goes through the SSRF-guarded
client. Segment progress is saved to `<job>.state.json` (at most once per second, and on
pause/failure); requests carry `If-Range` with the ETag/Last-Modified so a changed file is detected
and the download restarts cleanly. Servers without range support get a single streaming connection.

Transitions are enforced in `JobStore.update`. `completed` is set only after the final file
exists in `DOWNLOAD_DIR/<job_id>/` with the expected size. Temporary files are deleted for every
non-completed outcome.

## Why the frontend proxies the API

The browser talks only to the Next.js origin. This keeps the session cookie first-party
(`SameSite=Strict`, `HttpOnly`) and avoids exposing the API port. For production behind a reverse
proxy you may instead route `/api/` straight to the API (recommended, so the API sees real client
IPs for rate limiting — see DEPLOYMENT.md).

## Splitting out a worker

The MVP runs jobs in the API process (`JobRunner`). The routes only call `create_job`, `cancel`,
`start` and `stop` (the `JobQueue` protocol). To scale:

1. Implement `JobQueue` by pushing job IDs to Redis (RQ/Arq/Celery).
2. Run `JobRunner.execute(job_id)` in a separate worker container that shares `DOWNLOAD_DIR`
   (or uploads to object storage) and the database (move SQLite → PostgreSQL).
3. Give only the worker outbound internet access, with an egress firewall that blocks private
   ranges (defence in depth for yt-dlp), and give the API no outbound access at all.

See `services/worker/README.md`.
