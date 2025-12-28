#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$ROOT_DIR/AI_LOG.md"
TS="$(date +%Y-%m-%d\ %H:%M:%S)"
TITLE="${1:-AI step}"

TMP="$(mktemp)"
{
  if [ -f "$LOG_FILE" ]; then
    cat "$LOG_FILE"
    echo
  else
    echo "# AI LOG"
    echo
  fi

  echo "## $TS — $TITLE"
  echo
  echo '```'
  cat
  echo '```'
  echo
} > "$TMP"

mv "$TMP" "$LOG_FILE"
echo "OK: log írva -> $LOG_FILE"
