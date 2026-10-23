# Universal Downloader

[ภาษาไทย](README.md) · **English**

A web app where you paste a link, see what it really is (file type from magic bytes, size, redirects, media formats that actually exist) and download it through a cancellable job queue. Thai and English UI.

- **Frontend:** Next.js 15 + TypeScript + Tailwind CSS (`apps/web`)
- **Backend:** Python + FastAPI + HTTPX + yt-dlp + FFmpeg + SQLite (`services/api`)
- **Modes:** Local Mode (Windows 11) and Online Mode (Docker / any container platform)

> ⚠️ Only download content you have the right to. This tool does **not** bypass DRM, paywalls, logins or CAPTCHAs and cannot guarantee that every website works.

## Run it online on GitHub (Codespaces) — nothing to install locally

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/sahapornsalee/testbot?quickstart=1)

1. Click the button (or in the repo: **Code → Codespaces → Create codespace on main**).
2. The first start takes about 3–5 minutes: Python, Node.js, FFmpeg and yt-dlp are installed and the web UI is built automatically.
3. The UI opens in a new tab (otherwise: **PORTS** tab → port `3000` → globe icon).
4. Use it right away; finished files are saved to your computer through the browser's **Save file** button.

Terminal commands inside the codespace:

```bash
bash scripts/codespaces/start.sh   # (re)start — runs automatically whenever the codespace starts
bash scripts/codespaces/stop.sh    # stop
tail -f data/logs/api.log          # logs
git pull && bash scripts/codespaces/start.sh   # update (reinstalls/rebuilds automatically when code changed)
```

If the UI says **"Cannot reach the API server"**, the API is not running: run `bash scripts/codespaces/start.sh` again and check `tail -n 30 data/logs/api.log` for the reason.

**Security and cost**

- The codespace URL is **private**: only your GitHub account can open it. **Do not make port 3000 public** — this mode has no login, so anyone with the link could use your download server.
- Personal accounts get a free monthly quota (about 60 hours on a 2-core machine). Beyond that you are billed only if your spending limit is above 0. Stop the codespace when you are done (it also stops after 30 idle minutes). See <https://github.com/settings/billing>.
- A codespace is for personal use, not a public server; for that see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
- GitHub Pages cannot host this: it serves static files only and cannot run the API, yt-dlp or FFmpeg.

## What the MVP does

| Capability | Status |
|---|---|
| URL analysis (scheme, hostname, DNS, redirects, Content-Type, size, filename, magic bytes) | ✅ |
| SSRF protection (internal IPs, cloud metadata, DNS rebinding, redirects into internal networks) | ✅ |
| Streaming direct downloads with size/time limits; resumes with Range when a connection drops | ✅ |
| Media inspection with yt-dlp, only real formats listed, audio merge with FFmpeg | ✅ (tested with fixtures; real-site tests are optional) |
| Job queue: queued → inspecting → downloading → processing → completed / failed / cancelled / expired | ✅ |
| **Multi-connection downloads (IDM-style):** files split into segments fetched over up to 8 parallel connections; dropped segments resume automatically | ✅ (when the server supports Range) |
| **Pause / resume:** partial data is kept; jobs interrupted by a restart become paused; a changed source file restarts cleanly | ✅ (direct files) |
| **Grab everything on a page:** analyze a web page and pick anything on it — images (including lazy-loaded and CSS backgrounds), video, audio, documents, archives, streams hidden in player scripts, embedded videos (e.g. YouTube), other links, and the page itself (.html). No selection limit; the UI sends 50 per request | ✅ (pages that build their content with JavaScript after loading may be incomplete) |
| **HLS streams (.m3u8):** pick from the real qualities, parallel segment download, pause/resume, clear-key AES-128, remux to MP4 with FFmpeg | ✅ (no live streams, DRM or DASH .mpd) |
| **Batch add:** paste up to 50 links at once | ✅ |
| Cancellation, automatic cleanup of temporary and expired files | ✅ |
| Thai/English, responsive on mobile, tablet and desktop | ✅ |
| Bearer-token authentication for Online Mode | ✅ (basic — see [docs/SECURITY.md](docs/SECURITY.md)) |
| Playlists, multi-user accounts, separate worker container | ❌ not yet (see “Limitations”) |

---

## Windows 11 setup (Local Mode)

All commands are **PowerShell** (Windows Terminal → PowerShell).

### 1. Prerequisites

| Tool | Version | Required |
|---|---|---|
| Git | latest | for clone/commit (optional if you download a zip) |
| Python | 3.11+ (3.12 recommended) | ✅ |
| Node.js | 20.9+ (22 LTS recommended) | ✅ |
| FFmpeg | latest | optional (needed to merge audio into video-only formats) |

### 2. Install Git, Node.js, Python and FFmpeg

```powershell
winget install -e --id Git.Git
winget install -e --id Python.Python.3.12
winget install -e --id OpenJS.NodeJS.LTS
winget install -e --id Gyan.FFmpeg
```

Close and reopen the terminal so PATH is refreshed.

### 3. Check versions

```powershell
git --version
py -3 --version
node --version
npm.cmd --version
ffmpeg -version
```

Or check everything (tools, venv, `.env`, ports) at once:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check.ps1
```

> `-ExecutionPolicy Bypass` applies to that single command only; it does not change the system policy.

### 4. Create the virtual environment

```powershell
cd services\api
py -3 -m venv .venv
```

### 5. Install Python dependencies

```powershell
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
cd ..\..
```

### 6. Install Node dependencies

```powershell
cd apps\web
npm.cmd ci
cd ..\..
```

> Use `npm.cmd` instead of `npm` to avoid the `npm.ps1` execution-policy prompt without disabling the policy system-wide.

Steps 4–6 are automated by `.\scripts\dev.ps1 -Install`.

### 7. Configure `.env`

```powershell
Copy-Item .env.example .env
notepad .env
```

Useful values: `MAX_FILE_SIZE_MB`, `MAX_CONCURRENT_JOBS`, `TEMP_FILE_TTL_HOURS`, `FFMPEG_LOCATION` (if ffmpeg is not on PATH). Never commit `.env`.

### 8. Start the API

```powershell
cd services\api
.\.venv\Scripts\python.exe -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
```

Check <http://127.0.0.1:8000/api/v1/health> and the interactive docs at <http://127.0.0.1:8000/api/docs>.

### 9. Start the frontend (second window)

```powershell
cd apps\web
npm.cmd run dev
```

Open <http://localhost:3000>. The web server forwards `/api/v1/*` to `API_INTERNAL_URL` (default `http://127.0.0.1:8000`).

**Shortcut:** `powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1` starts the API (in the background) and the frontend together.

### 10. Run tests

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test.ps1          # lint + unit + integration + security + frontend + build
powershell -ExecutionPolicy Bypass -File .\scripts\test.ps1 -E2E     # plus Playwright end-to-end
```

Before the first E2E run install the browser: `cd apps\web; npx.cmd playwright install chromium`.
See [docs/TESTING.md](docs/TESTING.md).

### 11. Port already in use

```powershell
Get-NetTCPConnection -State Listen -LocalPort 8000,3000 | Select-Object LocalPort, OwningProcess
Get-Process -Id <OwningProcess>
Stop-Process -Id <OwningProcess>      # only if you are sure it can be stopped
```

Or use other ports: `.\scripts\dev.ps1 -ApiPort 8001 -WebPort 3001`
(when changing the web port, add e.g. `http://localhost:3001` to `ALLOWED_ORIGINS` in `.env`).

### 12. FFmpeg not on PATH

1. Check `Get-Command ffmpeg`. If not found, open a new terminal after installing.
2. Otherwise point to it in `.env`: `FFMPEG_LOCATION=C:\ffmpeg\bin\ffmpeg.exe` (or the folder `C:\ffmpeg\bin`).
3. Confirm in **Settings → Server status** or `/api/v1/health` (`tools.ffmpeg`).

Without FFmpeg direct downloads still work; only audio merging for video-only formats is unavailable.

### 13. Logs

- Started with `scripts\dev.ps1`: `Get-Content data\logs\api.log -Tail 50 -Wait` and `data\logs\api.err.log`.
- Started manually: JSON logs are printed in that window.
- Logs contain the request path only — never query strings, pasted URLs, cookies or tokens.

### 14. Stop the services

Press `Ctrl+C` in the running window (`dev.ps1` stops the API for you). For stuck processes see step 11.
Docker: `docker compose down`.

### 15. Clean temporary files

Finished files are deleted automatically after `TEMP_FILE_TTL_HOURS`, and stale temp files are swept. To wipe everything manually (stop the API first):

```powershell
Remove-Item -Recurse -Force services\api\data\tmp, services\api\data\downloads
```

> This deletes all downloaded files; job history in `app.db` remains.

### 16. Production build

```powershell
cd apps\web
$env:API_INTERNAL_URL = "http://127.0.0.1:8000"
npm.cmd run build
npm.cmd run start
```

Production API: set `APP_ENV=production`, `AUTH_REQUIRED=true`, `API_TOKENS=...` and run uvicorn as in step 8. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### 17. Docker Compose

Requires Docker Desktop.

```powershell
docker compose up -d --build
docker compose ps
docker compose logs -f api
docker compose down
```

Open <http://localhost:3000>. Ports are bound to `127.0.0.1` only (reachable from this computer only).

---

## Using it with GitHub

The project is GitHub-ready: `.gitignore` (keeps `.env`, databases and downloads out), `LICENSE` (MIT) and GitHub Actions (`.github/workflows/ci.yml`) that run lint, unit/integration/security tests, dependency audits, the frontend build, Playwright E2E and a Docker build on every push and pull request — **no secrets, no automatic deployment**.

Starting from a fresh folder without Git:

```powershell
git init
git add .
git commit -m "Initial Universal Downloader MVP"
```

After you create an empty repository on GitHub yourself (without README/.gitignore):

```powershell
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

Run `git status` before pushing and make sure no `.env`, `*.db` or `data/` folder is included.

## More documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/API.md](docs/API.md) · [docs/SECURITY.md](docs/SECURITY.md) · [docs/TESTING.md](docs/TESTING.md) · [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Limitations

- Only publicly accessible content; no login-protected, DRM or paywalled content.
- yt-dlp performs its own network requests (not through the connection-level SSRF guard), so it is only used for sites with a dedicated extractor, and Online Mode must restrict the API host's egress — see [docs/SECURITY.md](docs/SECURITY.md).
- The job runner lives in the API process (single machine). Jobs running during a restart are marked `failed` (`INTERRUPTED`).
- Rate limits are in memory; multiple processes need Redis or a reverse proxy.
- No playlist support yet.
- DASH (`.mpd`), live streams and DRM-protected streams are not supported, and there is no browser extension that captures downloads like IDM's.
- Pages that build their content with JavaScript after loading (e.g. infinite scroll) only expose what is in the initial HTML.
- Only direct-file jobs can be paused; yt-dlp media jobs can be cancelled but not paused.

## License

[MIT](LICENSE)
