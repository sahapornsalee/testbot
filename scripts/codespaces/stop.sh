#!/usr/bin/env bash
# Stops the services started by start.sh.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
for name in web api; do
  pidfile="$ROOT/data/logs/$name.pid"
  if [ -f "$pidfile" ]; then
    pid="$(cat "$pidfile")"
    # start.sh runs each service in its own process group (setsid), so this also
    # stops children such as the next server spawned by npm.
    kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    rm -f "$pidfile"
    echo "stopped $name"
  fi
done
