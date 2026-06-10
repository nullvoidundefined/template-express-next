#!/usr/bin/env bash
# Ensures the E2E test database exists, is migrated, and is seeded.
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://localhost:5432/template_test}"
DB_NAME=$(echo "$DB_URL" | sed 's|.*/||' | sed 's|?.*||')

createdb "$DB_NAME" 2>/dev/null && echo "[ensure-test-db] Created database $DB_NAME" \
  || echo "[ensure-test-db] Database $DB_NAME already exists"

echo "[ensure-test-db] Running migrations..."
DATABASE_URL="$DB_URL" pnpm --filter server run migrate:up

echo "[ensure-test-db] Seeding test data..."
DATABASE_URL="$DB_URL" pnpm --filter server run seed:test

echo "[ensure-test-db] Done."
