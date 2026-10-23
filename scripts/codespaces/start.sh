#!/usr/bin/env bash
# Starts the API (127.0.0.1:8000, not forwarded) and the web UI (port 3000) in the background.
# Logs: data/logs/api.log and data/logs/web.log. Stop with: bash scripts/codespaces/stop.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOGS="$ROOT/data/logs"
mkdir -p "$LOGS"

# The browser reaches the UI through the Codespaces forwarding domain, so that origin must
# be allowlisted for the API's CORS/CSRF checks.
ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
if [ -n "${CODESPACE_NAME:-}" ] && [ -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]; then
  ORIGINS="https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN},${ORIGINS}"
fi

# Re-run setup when the code changed since the last install/build (e.g. after `git pull`),
# so new dependencies get installed and the web UI is rebuilt.
STAMP="$ROOT/data/.setup-fingerprint"
CURRENT="$(bash "$ROOT/scripts/codespaces/fingerprint.sh")"
if [ ! -x "$ROOT/services/api/.venv/bin/python" ] || [ ! -d "$ROOT/apps/web/.next" ] \
  || [ ! -f "$STAMP" ] || [ "$(cat "$STAMP")" != "$CURRENT" ]; then
  echo "==> Code changed since the last setup: installing dependencies and rebuilding"
  bash "$ROOT/scripts/codespaces/setup.sh"
fi

bash "$ROOT/scripts/codespaces/stop.sh" >/dev/null 2>&1 || true

echo "==> Starting API"
cd "$ROOT/services/api"
ALLOWED_ORIGINS="$ORIGINS" APP_HOST=127.0.0.1 API_PORT=8000 \
  setsid nohup .venv/bin/python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000 \
  >"$LOGS/api.log" 2>&1 &
echo $! >"$LOGS/api.pid"

echo "==> Starting web UI"
cd "$ROOT/apps/web"
API_INTERNAL_URL=http://127.0.0.1:8000 NEXT_TELEMETRY_DISABLED=1 \
  setsid nohup npm run start -- -H 0.0.0.0 -p 3000 >"$LOGS/web.log" 2>&1 &
echo $! >"$LOGS/web.pid"

for _ in $(seq 1 60); do
  if curl -sf http://127.0.0.1:8000/api/v1/health >/dev/null && curl -sf http://127.0.0.1:3000/ >/dev/null; then
    echo "==> Universal Downloader is running"
    if [ -n "${CODESPACE_NAME:-}" ]; then
      echo "    Open: https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
    else
      echo "    Open: http://localhost:3000"
    fi
    exit 0
  fi
  sleep 1
done
echo "!! Services did not become ready. Last log lines:" >&2
tail -n 20 "$LOGS/api.log" "$LOGS/web.log" >&2
exit 1
