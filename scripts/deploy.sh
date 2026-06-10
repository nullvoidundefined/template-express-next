#!/usr/bin/env bash
# Deploy to Railway. Usage: ./scripts/deploy.sh [production|staging] [full|web|server|migrate]
set -euo pipefail

ENVIRONMENT="${1:-staging}"
TARGET="${2:-full}"

if [[ "$ENVIRONMENT" != "production" && "$ENVIRONMENT" != "staging" ]]; then
  echo "Usage: $0 [production|staging] [full|web|server|migrate]"
  exit 1
fi

echo "Deploying $TARGET to $ENVIRONMENT..."

run_migrations() {
  echo "[deploy] Running migrations..."
  railway run --environment "$ENVIRONMENT" -- pnpm --filter ./apps/server run migrate:up
}

deploy_server() {
  echo "[deploy] Deploying server..."
  railway up -d --environment "$ENVIRONMENT" --service server
}

deploy_web() {
  echo "[deploy] Deploying web..."
  railway up -d --environment "$ENVIRONMENT" --service web
}

wait_for_healthy() {
  local url="$1"
  echo "[deploy] Waiting for $url to be healthy..."
  for i in $(seq 1 10); do
    if curl -sf "$url" > /dev/null 2>&1; then
      echo "[deploy] $url is healthy"
      return 0
    fi
    echo "[deploy] Attempt $i/10..."
    sleep 10
  done
  echo "[deploy] FAILED: $url did not become healthy"
  return 1
}

case "$TARGET" in
  full)
    run_migrations
    deploy_server &
    deploy_web &
    wait
    ;;
  server)
    deploy_server
    ;;
  web)
    deploy_web
    ;;
  migrate)
    run_migrations
    ;;
  *)
    echo "Unknown target: $TARGET"
    exit 1
    ;;
esac

echo "[deploy] Done."
