#!/usr/bin/env sh
# POSIX shell wrapper to call the Node launcher
ROOT="$(cd "$(dirname "$0")" && pwd)"
LAUNCHER="$ROOT/scripts/launcher.js"
if [ -f "$LAUNCHER" ]; then
  node "$LAUNCHER" "$@"
else
  echo "Launcher not found: $LAUNCHER"
fi
