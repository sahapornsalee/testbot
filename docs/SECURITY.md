# Security

Fetching arbitrary user-supplied URLs on a server is dangerous. This document lists what is
implemented, how it is tested, and what remains your responsibility before going online.

## SSRF protection (implemented)

| Control | Where |
|---|---|
| Only `http`/`https`; no credentials in URLs; no whitespace, control chars or backslashes | `url_policy.validate_url` |
| Integer/octal/hex IPv4 spellings (`2130706433`, `0x7f.1`, `127.1`) rejected | `_looks_like_legacy_ipv4` |
| Hostnames `localhost`, `*.local`, `*.internal`, `*.home.arpa`, `metadata.google.internal`, single-label names rejected; IDN hosts IDNA-encoded | `validate_url` |
| Ports < 1024 other than 80/443 rejected | `validate_url` |
| Every resolved address must be public unicast: loopback, RFC 1918, CGNAT (incl. 100.100.100.200), link-local (incl. 169.254.169.254), multicast, reserved, ULA, `fd00:ec2::254`, IPv4-mapped/6to4/Teredo/NAT64 embeddings are blocked; if **any** answer is internal the host is rejected | `is_public_address`, `DestinationPolicy.resolve` |
| DNS rebinding / TOCTOU: the TCP connection is opened to the exact IP that was validated, at connect time; TLS still verifies the original hostname | `safe_http.GuardedNetworkBackend` |
| Automatic redirects disabled; each hop is re-validated and re-resolved; at most `MAX_REDIRECTS` | `safe_http.open_stream` |
| Environment proxies ignored (`trust_env=False`) so pinning cannot be bypassed | `safe_http.build_client` |
| Unix sockets refused | `GuardedNetworkBackend.connect_unix_socket` |
| `X-Forwarded-For` is never trusted | `security.client_key` |
| Frontend checks are cosmetic only; all enforcement is server-side | — |

Tests: `services/api/tests/security/test_ssrf.py` uses mock resolvers and a local fixture server
explicitly allowlisted **in code** for tests (`DestinationPolicy(extra_allowed_networks=...)`); that
allowlist is not configurable through environment variables.

### yt-dlp caveat (residual risk)

yt-dlp makes its own HTTP requests (to the page and to CDNs it discovers), which do **not** pass
through the pinned transport. Mitigations in code: yt-dlp is used only when a site-specific
extractor (not the generic one) matches, after the hostname passed the policy; it runs with
`--no-config`, `--no-playlist`, no cookies, and the URL after `--`. **For Online Mode you must also
block private ranges at the network layer** for the process/container that runs downloads
(firewall egress rules, a dedicated network namespace, or a cloud security group). Set
`YTDLP_ENABLED=false` if you cannot do this.

## File safety (implemented)

- Size limit enforced on the stream (with or without Content-Length), on decoded bytes.
- Connect/read timeouts plus an overall `JOB_TIMEOUT_SECONDS`; cancellation kills subprocesses.
- Storage budget `MAX_STORAGE_MB` across temp and download dirs.
- Downloads never execute or extract anything, so archives cannot "bomb" the server; risky types
  (`.exe`, `.ps1`, …) are flagged to the user.
- Filenames are sanitized (directory components, control/reserved chars, Windows device names,
  length); files live in `DOWNLOAD_DIR/<random job id>/`; every path is checked to stay inside the
  storage roots.
- Files are deleted after `TEMP_FILE_TTL_HOURS`; stale temp files are swept.
- The API never returns filesystem paths. Files are served as attachments with `nosniff` and a
  sandbox CSP; HTML/SVG/XML are served as `application/octet-stream`.
- Every job and file request checks ownership (IDOR → `404`).

## Request-level protections (implemented)

- Rate limit per client IP and per owner on inspect/create (in-memory).
- Active-job quota per owner and a global concurrency limit.
- Request body limit (`MAX_REQUEST_BODY_BYTES`).
- CORS allowlist (`ALLOWED_ORIGINS`), never `*` in production.
- CSRF: `X-UD-Client: web` header required on POST (forces a preflight for cross-site requests)
  plus `Origin` check; session cookie is `HttpOnly`, `SameSite=Strict`, `Secure` in production.
- Bearer tokens compared in constant time; tokens must be ≥ 24 characters.
- `APP_ENV=production` refuses to start unless `AUTH_REQUIRED=true` with tokens configured.
- Structured JSON logs with path only — no query strings, pasted URLs, cookies or tokens.
- Validation errors never echo input; unexpected errors return `INTERNAL_ERROR` without a stack trace.
- Subprocesses use argument lists only, never a shell; TLS verification is never disabled.

## Before exposing the service publicly (your responsibility)

1. `APP_ENV=production`, `AUTH_REQUIRED=true`, strong random `API_TOKENS` stored as platform
   secrets — never in the repository.
2. HTTPS via a reverse proxy or managed platform; HSTS at the proxy.
3. Network egress restrictions for the downloader (see yt-dlp caveat).
4. Rate limiting at the proxy too (the in-memory limiter is per process). If the API sits behind a
   trusted proxy, run uvicorn with `--proxy-headers --forwarded-allow-ips=<proxy ip>`.
5. Review the legal terms of the sites your users will download from.
6. Keep `yt-dlp`, `ffmpeg`, Next.js and Python dependencies updated (CI runs `pip-audit` and
   `npm audit --omit=dev`).

The bearer-token scheme is meant for a small set of trusted users. A public multi-user service
needs real accounts, per-user quotas and abuse monitoring, which are **not** part of this MVP.

## Known dev-only advisories

`npm audit` (including dev dependencies) currently reports advisories in test/build tooling
(vitest's `tinypool`, `braces`, `postcss-selector-parser` via Tailwind 3). They are not shipped to
users; production dependencies audit clean (`npm audit --omit=dev`).

## Reporting

Please report vulnerabilities privately to the repository owner instead of opening a public issue.
