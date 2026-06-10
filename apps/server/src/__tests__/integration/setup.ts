// Shared setup for integration tests (registered as a vitest setupFile in
// vitest.integration.config.ts). Ensures the schema is migrated once per file,
// truncates every application table between tests for isolation, and closes the
// pool when the file finishes. Test files no longer manage their own cleanup.
import { pool } from 'app/database/databasePool.js';
import { execSync } from 'node:child_process';
import { afterAll, beforeAll, beforeEach } from 'vitest';

const APP_TABLES =
  'idempotency_keys, posts, password_resets, sessions, stripe_events, subscriptions, users';

function isLocalDatabase(url: string): boolean {
  return (
    /@?(localhost|127\.0\.0\.1)[:/]/.test(url) || url.includes('localhost')
  );
}

beforeAll(() => {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  // R-110: integration migrations only ever run against a LOCAL database.
  // node-pg-migrate's bin loads dotenv, so refuse anything non-local outright.
  if (!isLocalDatabase(url)) {
    throw new Error(
      'Integration tests must use a LOCAL DATABASE_URL (R-110); refusing to migrate a remote database.',
    );
  }
  execSync('node_modules/.bin/node-pg-migrate up', {
    env: process.env,
    stdio: 'inherit',
  });
});

beforeEach(async () => {
  if (!process.env.DATABASE_URL) return;
  await pool.query(`TRUNCATE ${APP_TABLES} CASCADE`);
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  await pool.end();
});
