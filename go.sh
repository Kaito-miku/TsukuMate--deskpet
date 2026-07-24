#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$ROOT/tsukumate"
COMMAND="${1:-start}"

cd "$APP_DIR"
if [[ ! -d node_modules ]]; then
  npm install
fi

case "$COMMAND" in
  start) exec npm start ;;
  test) exec npm test ;;
  build) exec npm run build ;;
  *) echo "Usage: ./go.sh [start|test|build]" >&2; exit 2 ;;
esac
