# API reference (`/api/v1`)

Interactive OpenAPI docs: `http://127.0.0.1:8000/api/docs` (disabled when `APP_ENV=production`).

## Conventions

- JSON in/out. Request bodies are limited to `MAX_REQUEST_BODY_BYTES` (default 128 KB).
- **Identity:** Local Mode issues an `ud_session` HttpOnly cookie automatically. With
  `AUTH_REQUIRED=true`, send `Authorization: Bearer <token>` (token from `API_TOKENS`).
- **CSRF:** every `POST` must include `X-UD-Client: web`; if an `Origin` header is present it must
  be in `ALLOWED_ORIGINS`.
- Jobs are visible only to their owner. Someone else's job returns `404 JOB_NOT_FOUND`.
- Errors always look like:

```json
{ "error": { "code": "BLOCKED_DESTINATION", "message": "Destination address is not allowed" } }
```

## Endpoints

### `GET /health`
Public. `{"status":"ok","version":"0.1.0","environment":"development","auth_required":false,"tools":{"yt_dlp":"2026.10.21","ffmpeg":"7.1"}}`

### `POST /inspect`
Body `{"url": "https://example.com/file.pdf"}`. Validates the URL, resolves DNS, follows up to
`MAX_REDIRECTS` validated redirects, and reads only the headers plus the first 8 KB.

Response (`InspectResponse`):

| Field | Meaning |
|---|---|
| `kind` | `file`, `media` (yt-dlp extractor matched) or `webpage` (HTML, not downloadable) |
| `final_url`, `redirect_chain` | where the link ended up |
| `content_type` | from magic bytes > declared type > extension |
| `declared_content_type` | what the server claimed |
| `category` | `image`, `video`, `audio`, `document`, `archive`, `other` |
| `size_bytes` | `null` when unknown |
| `filename`, `extension` | sanitized |
| `accepts_ranges` | server supports byte ranges |
| `downloadable` | false for web pages or files over the limit |
| `warnings` | `SIZE_UNKNOWN`, `FILE_TOO_LARGE`, `WEBPAGE_NOT_FILE`, `RISKY_FILE_TYPE`, `NO_FORMATS`, `FFMPEG_MISSING` |
| `links` | for `kind=webpage`: downloadable resources found on the page — `url`, `category` (`image`/`video`/`audio`/`document`/`archive`/`other`/`stream`), `extension`, `source` element, `label` (link text/alt). Max 500; only the page is fetched (≤ `MAX_PAGE_BYTES`), each link is validated again when downloaded |
| `media` | for `kind=media`: `title`, `duration_seconds`, `uploader`, `extractor`, `formats[]`, `best_format_id`, `ffmpeg_available` |

Each media format: `format_id`, `ext`, `kind` (`video+audio`/`video`/`audio`), `width`, `height`,
`fps`, `vcodec`, `acodec`, `abr`, `tbr`, `filesize`, `filesize_approx`, `note`. Only formats yt-dlp
reports are listed; DRM formats and storyboards are removed.

### `POST /downloads` → `202`
```json
{ "url": "https://example.com/file.pdf", "mode": "direct" }
{ "url": "https://video.example/watch?v=1", "mode": "media", "format_id": "137", "merge_audio": true }
```
`format_id` must match `^[A-Za-z0-9_.-]{1,64}$` and is re-verified against a fresh inspection when
the job runs. `merge_audio` only applies to video-only formats and needs FFmpeg.
Returns a `JobView`.

### `POST /downloads/batch` → `202`
`{"items": [CreateDownload, ...]}` (at most `MAX_BATCH_SIZE`, default 50). Each item is validated
separately: `{"created": [JobView, ...], "errors": [{"index": 1, "url": "...", "error": {code, message}}]}`.

### `POST /downloads/{job_id}/pause` · `POST /downloads/{job_id}/resume`
Pause keeps the partial file and per-segment progress (`<job>.part` + `<job>.state.json` in
`TEMP_DIR`); resume continues from the saved offsets using `Range` + `If-Range`, and restarts from
zero automatically if the server reports the file changed. Only direct downloads can be paused
(`409 INVALID_STATE` otherwise). Paused jobs are kept for `max(TEMP_FILE_TTL_HOURS, 24h)` and can
also be cancelled.

### `GET /downloads`
`{"items": [JobView, ...]}` — newest first, at most 100.

### `GET /downloads/{job_id}`
`job_id` is 32 lowercase hex characters.

`JobView`: `id`, `status`, `mode`, `source_host`, `filename`, `category`, `content_type`,
`format_id`, `expected_size`, `actual_size`, `downloaded_bytes`, `progress` (0–1 or `null` when the
total is unknown), `created_at`, `started_at`, `finished_at`, `error` (`{code,message}` or `null`),
`download_available`, `connections` (parallel segments used), `can_pause`, `can_resume`. Status can
also be `paused`. Local filesystem paths are never returned.

### `POST /downloads/{job_id}/cancel`
Cancels a queued or running job (`409 INVALID_STATE` otherwise). Temp files are removed.

### `GET /downloads/{job_id}/file`
Streams the result as an attachment (supports `Range`). Sent with `X-Content-Type-Options: nosniff`
and `Content-Security-Policy: sandbox`; HTML/SVG/XML are served as `application/octet-stream`.
`409 JOB_NOT_READY` when not completed or expired.

## Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `INVALID_URL` | 422 | malformed URL, unsupported scheme, credentials in URL, odd IP notation |
| `BLOCKED_DESTINATION` | 403 | resolves to / redirects to a non-public address, internal hostname, blocked port |
| `UNSUPPORTED_SOURCE` | 422 | site unsupported, private, login/DRM required, playlist |
| `UNSUPPORTED_CONTENT` | 415 | web page instead of a file |
| `FILE_TOO_LARGE` | 413 | exceeds `MAX_FILE_SIZE_MB` |
| `STORAGE_FULL` | 507 | exceeds `MAX_STORAGE_MB` |
| `DOWNLOAD_TIMEOUT` | 504 | connect/read timeout or `JOB_TIMEOUT_SECONDS` |
| `SOURCE_UNAVAILABLE` | 502 | DNS failure, connection error, HTTP ≥ 400 |
| `TOO_MANY_REDIRECTS` | 502 | more than `MAX_REDIRECTS` |
| `INCOMPLETE_DOWNLOAD` | 502 | truncated body, size mismatch, resume impossible |
| `FORMAT_NOT_AVAILABLE` | 422 | format missing / not chosen |
| `MEDIA_TOOL_MISSING` | 503 | yt-dlp or FFmpeg missing |
| `MEDIA_PROCESSING_FAILED` | 500 | yt-dlp/FFmpeg failed |
| `JOB_NOT_FOUND` | 404 | unknown job or not yours |
| `JOB_NOT_READY` | 409 | file not available |
| `INVALID_STATE` | 409 | action not allowed in current state |
| `QUOTA_EXCEEDED` | 429 | `MAX_ACTIVE_JOBS_PER_OWNER` reached |
| `RATE_LIMITED` | 429 | `RATE_LIMIT_PER_MINUTE` reached |
| `UNAUTHORIZED` | 401 | missing/invalid token or session |
| `FORBIDDEN_ORIGIN` | 403 | missing `X-UD-Client` or foreign `Origin` |
| `REQUEST_TOO_LARGE` | 413 | body too large |
| `VALIDATION_ERROR` | 422 | schema validation failed (input is not echoed) |
| `INTERRUPTED` | 500 | server restarted during the job |
| `INTERNAL_ERROR` | 500 | unexpected; details only in server logs |

The frontend translates every code (`apps/web/src/i18n/messages/*.json`); a backend test fails if a
code has no Thai or English translation.
