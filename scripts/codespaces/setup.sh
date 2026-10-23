#!/usr/bin/env bash
# One-time setup for GitHub Codespaces (also usable on any Debian/Ubuntu machine).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "==> Installing FFmpeg"
  SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
  $SUDO apt-get update -y
  $SUDO apt-get install -y --no-install-recommends ffmpeg
fi

echo "==> Installing API dependencies"
cd "$ROOT/services/api"
[ -d .venv ] || python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip --quiet
.venv/bin/python -m pip install -e ".[dev]" --quiet

echo "==> Installing and building the web UI"
cd "$ROOT/apps/web"
npm ci --no-audit --no-fund
API_INTERNAL_URL=http://127.0.0.1:8000 NEXT_TELEMETRY_DISABLED=1 npm run build

echo "==> Setup complete"
