# Deployment

## 1. Local (Windows 11)

See the README: `.\scripts\dev.ps1 -Install`, then open <http://localhost:3000>. Everything binds to
`127.0.0.1`. No cloud or GitHub account is required.

## 2. Docker Compose (local or a trusted server)

```bash
cp .env.example .env        # adjust limits
docker compose up -d --build
docker compose ps           # both services should be "healthy"
```

- `api` image: Python 3.12 slim + FFmpeg + yt-dlp, non-root user, read-only root filesystem,
  `cap_drop: ALL`, data in the `ud-data` volume (`/data`), health check on `/api/v1/health`.
- `web` image: Next.js standalone output, non-root, read-only.
- Ports are published on `127.0.0.1` only. The web container forwards `/api/v1/*` to
  `http://api:8000` (baked in at build time via the `API_INTERNAL_URL` build arg).
- `docker compose down` stops; `docker compose down -v` also deletes the data volume.
- On `SIGTERM` uvicorn shuts down gracefully (20 s); unfinished jobs are marked `INTERRUPTED` at
  the next start.

## 3. Online deployment

Online Mode needs a platform that runs long-lived containers with a writable disk, e.g. a VPS with
Docker, Fly.io, Railway, Render, Google Cloud Run (with a mounted volume), Azure Container Apps.

**Not suitable:** GitHub Pages (static files only — it cannot run FastAPI, the job runner or
FFmpeg) and GitHub Actions (CI jobs are not a server and must not be used as a download service).

### Checklist

1. **Configuration** (as platform secrets/env vars, never committed):
   ```
   APP_ENV=production
   AUTH_REQUIRED=true
   API_TOKENS=<random token(s), ≥ 24 chars>
   ALLOWED_ORIGINS=https://your-domain.example
   MAX_FILE_SIZE_MB=500
   MAX_STORAGE_MB=5000
   MAX_CONCURRENT_JOBS=2
   TEMP_FILE_TTL_HOURS=2
   DATABASE_URL=sqlite:////data/app.db
   DOWNLOAD_DIR=/data/downloads
   TEMP_DIR=/data/tmp
   ```
   Keep development and production `.env` files separate.
2. **HTTPS:** terminate TLS at a reverse proxy (Caddy, nginx, Traefik) or the platform's managed
   TLS. Example Caddyfile routing the API directly so it sees real client IPs:
   ```
   your-domain.example {
     handle /api/* {
       reverse_proxy api:8000
     }
     handle {
       reverse_proxy web:3000
     }
   }
   ```
   With a trusted proxy in front, start uvicorn with
   `--proxy-headers --forwarded-allow-ips=<proxy address>`.
3. **Egress restriction** for the API container: allow outbound 80/443 to the internet, deny
   RFC 1918, 100.64.0.0/10, 169.254.0.0/16 and IPv6 ULA/link-local (see SECURITY.md).
4. **Storage:** mount persistent storage only at `/data`. Downloads are temporary by design; size
   the volume for `MAX_STORAGE_MB` and keep the TTL short.
5. **Health checks:** `GET /api/v1/health` (API) and `GET /` (web).
6. **Single instance:** the in-process job runner and in-memory rate limiter assume one API
   replica. Scale-out requires the worker split described in ARCHITECTURE.md.
7. **Deployment trigger:** deploy manually or from protected `main` only. The provided CI never
   deploys and never uses secrets; do not add auto-deploys for pull requests from forks.

### Costs and limits to expect

Bandwidth is the main cost: every download is fetched by the server and then sent to the user
(roughly 2× the file size of traffic). Free tiers usually have small disks, sleep on idle (which
interrupts jobs) and cap egress. Some platforms forbid this type of workload in their terms — check
before deploying. Media sites may rate-limit or block datacenter IPs.

## 4. Frontend-only static hosting

Not supported: the UI relies on the Next.js server to proxy `/api/v1`. If you host the UI
elsewhere, you must also route `/api/v1` on the same origin to the API.
