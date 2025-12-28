#!/usr/bin/env bash
set -euo pipefail

# Magyar komment: build + dist deploy a resource web mappába (shellfüggetlen, stabil)
npm -w tablet-ui run build

mkdir -p resources/hp-tablet/web

# Magyar komment: web mappa ürítése biztonságosan (ha üres, akkor se hibázzon)
find resources/hp-tablet/web -mindepth 1 -maxdepth 1 -exec rm -rf {} +

# Magyar komment: dist másolás
cp -R apps/tablet-ui/dist/. resources/hp-tablet/web/

echo "OK: Deploy kész -> resources/hp-tablet/web"
