#!/usr/bin/env bash
# One-time setup for GitHub Codespaces (also usable on any Debian/Ubuntu machine).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "==> Installing FFmpeg"
  SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
  # The devcontainer Python image ships a Yarn apt source whose signing key has expired,
  # which makes `apt-get update` fail. Yarn is not needed here, so drop that source.
  for list in /etc/apt/sources.list.d/*.list; do
    if [ -f "$list" ] && grep -q "dl.yarnpkg.com" "$list"; then
      $SUDO rm -f "$list"
    fi
  done
  # FFmpeg is optional (only needed to merge audio into video-only formats), so an apt
  # problem must not stop the rest of the setup.
  if ! { $SUDO apt-get update -y && $SUDO apt-get install -y --no-install-recommends ffmpeg; }; then
    echo "!! FFmpeg could not be installed; continuing without it (audio merging disabled)" >&2
  fi
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
