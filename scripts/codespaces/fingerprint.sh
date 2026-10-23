#!/usr/bin/env bash
# Prints a hash of the API and web sources (committed files plus local edits).
# start.sh compares it with the one saved by setup.sh to know when to reinstall/rebuild.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  {
    git ls-files -s -- services/api apps/web
    git diff HEAD -- services/api apps/web
    git ls-files --others --exclude-standard -- services/api apps/web
  } | sha256sum | cut -d" " -f1
else
  find services/api apps/web -type f -not -path "*/node_modules/*" -not -path "*/.venv/*" \
    -not -path "*/.next/*" -not -path "*/data/*" -printf "%p %T@\n" | sort | sha256sum | cut -d" " -f1
fi
