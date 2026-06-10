#!/usr/bin/env bash
# Runs pnpm dev in a loop, clearing .next cache on crash.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NEXT_DIR="$ROOT/apps/client/web/.next"

while true; do
  echo "[dev-watch] Starting dev server..."
  (cd "$ROOT" && pnpm dev) || true
  echo ""
  echo "[dev-watch] Dev server exited. Clearing .next cache and restarting in 2s..."
  rm -rf "$NEXT_DIR"
  sleep 2
done
