#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TS="$(date +%Y%m%d-%H%M%S)"
BK_DIR="$ROOT_DIR/_backup/hpx-tablet-$TS"

mkdir -p "$BK_DIR"

# Magyar komment: csak a releváns dolgokat mentjük, gyors és biztos
cp -R "$ROOT_DIR/apps/tablet-ui" "$BK_DIR/tablet-ui"
cp -R "$ROOT_DIR/resources/hp-tablet" "$BK_DIR/hp-tablet"

# root file-ok (ha vannak)
[ -f "$ROOT_DIR/package.json" ] && cp "$ROOT_DIR/package.json" "$BK_DIR/package.json" || true
[ -f "$ROOT_DIR/package-lock.json" ] && cp "$ROOT_DIR/package-lock.json" "$BK_DIR/package-lock.json" || true

echo "Backup kész: $BK_DIR"
