#!/usr/bin/env bash
# Builds the static site and deploys it to Vercel production.
#   NEXT_PUBLIC_UPWORK_URL=...  adds the hire buttons
#   NEXT_PUBLIC_SOURCE_URL=...  adds the source links (once the repo is public)
set -euo pipefail
cd "$(dirname "$0")/../apps/web"
NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://orderly-sandro.vercel.app}" pnpm exec next build
DEPLOY_DIR="${DEPLOY_DIR:-$(mktemp -d)/orderly-demo}"
mkdir -p "$DEPLOY_DIR"
find "$DEPLOY_DIR" -mindepth 1 -maxdepth 1 ! -name .vercel -exec rm -rf {} +
cp -R out/. "$DEPLOY_DIR/"
printf '{ "rewrites": [{ "source": "/favicon.ico", "destination": "/icon.svg" }] }\n' > "$DEPLOY_DIR/vercel.json"
cd "$DEPLOY_DIR" && vercel deploy --prod --yes
