#!/usr/bin/env sh
# macOS double-clickable wrapper (same as launch-discord.sh)
ROOT="$(cd "$(dirname "$0")" && pwd)"
LAUNCHER="$ROOT/scripts/launcher.js"
if [ -f "$LAUNCHER" ]; then
  node "$LAUNCHER" "$@"
else
  echo "Launcher not found: $LAUNCHER"
fi
