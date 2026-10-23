# Testing

| Suite | Location | Command (from repo root, bash) | PowerShell |
|---|---|---|---|
| API lint | `services/api` | `cd services/api && ruff check . && ruff format --check .` | `.\scripts\test.ps1 -SkipWeb` |
| API unit | `services/api/tests/unit` | `pytest tests/unit` | ″ |
| API integration | `services/api/tests/integration` | `pytest tests/integration` | ″ |
| API security | `services/api/tests/security` | `pytest tests/security` | ″ |
| Web lint/types | `apps/web` | `npm run lint && npm run typecheck` | `.\scripts\test.ps1 -SkipApi` |
| Web unit | `apps/web/tests/unit` | `npm test` | ″ |
| E2E smoke | `apps/web/tests/e2e` | `npm run build && npm run e2e` | `.\scripts\test.ps1 -E2E` |
| Real websites (optional) | `tests/integration/test_external_optional.py` | `RUN_EXTERNAL_TESTS=1 pytest -m external` | `$env:RUN_EXTERNAL_TESTS=1; .\.venv\Scripts\python.exe -m pytest -m external` |

## What is covered

**Unit:** URL validation (schemes, credentials, IDN, legacy IP notations, internal hostnames,
ports), MIME sniffing vs. extension, categories, filename sanitization and Windows device names,
Content-Disposition parsing, job state transitions and ownership, error mapping, yt-dlp format
parsing (DRM/storyboard removal, best-format choice, unsafe IDs), subprocess argument building,
progress parsing, and that every error code has Thai and English translations.

**Integration (local fixture HTTP server):** inspect with/without Content-Length, magic bytes vs.
misleading extension, safe and unsafe redirects, web pages, oversized files (with and without
Content-Length), truncated bodies, Range resume after a dropped connection, cancellation with temp
cleanup, job timeout, retention/expiry cleanup, stale temp sweep, per-owner quota, media job flow
with yt-dlp faked (merge selection, unknown format).

**Security:** 24 non-public address classes, hostnames resolving to them, IP-literal URLs, mixed
DNS answers, DNS rebinding blocked at connect time, redirects to RFC 1918 / metadata / loopback
aliases, redirect loops, unauthorized job/file access (IDOR), path traversal via
Content-Disposition, no filesystem paths in responses, oversized bodies, malformed URLs, no input
echo, CSRF header and Origin checks, CORS allowlist, rate limiting, token auth, production config
guard, security headers.

**Frontend (Vitest + Testing Library):** pasting a URL and calling the API, empty input, localized
API and network errors, analysis display, direct and media job creation, real-format listing and
best-format preselection, merge option and FFmpeg-missing message, job progress (known and unknown
totals), cancel, failed-job errors, save button only when completed, language switching and
persistence, translation key parity.

**E2E (Playwright, desktop + Pixel 7 viewport):** analyze → download → completed → browser save
dialog; blocked metadata address shows a Thai error; cancel a running download; settings page shows
server status; no horizontal overflow on mobile.

SSRF tests never contact real internal systems: they use mock resolvers and the local fixture
server, which `tests/e2e_server.py` and `tests/conftest.py` allowlist in code only.

## E2E details

`apps/web/playwright.config.ts` starts `python -m tests.e2e_server` (API + fixture file server on
port 8765) and `next start`. Set `PYTHON` to the venv interpreter and, if Playwright cannot download
browsers, `PLAYWRIGHT_CHROMIUM_PATH` to an existing Chromium.
