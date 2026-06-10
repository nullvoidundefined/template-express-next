/**
 * Seeds baseline data for the E2E test database.
 *
 * Invoked by CI (`.github/workflows/ci.yml`) and by `e2e/global-setup.ts`
 * after migrations have run, before Playwright starts. Must be idempotent:
 * it runs on every E2E job against a database that may already hold rows from
 * a previous run.
 *
 * This template ships a no-op placeholder. The auth E2E specs register their
 * own users at runtime, so no seed data is required out of the box. Add
 * project-specific fixtures here (reference data, a known admin user, etc.)
 * using the shared pool, and keep every insert idempotent with
 * `ON CONFLICT DO NOTHING`.
 */
import { pool, query } from 'app/db/pool/pool.js';
import { logger } from 'app/utils/logs/logger.js';

async function seedTestData(): Promise<void> {
  // Verify connectivity so a misconfigured DATABASE_URL fails loudly here,
  // rather than mid-test with an opaque Playwright error.
  await query('SELECT 1');

  // Example idempotent insert. Uncomment and adapt per project:
  // await query(
  //   `INSERT INTO users (id, email, password_hash)
  //        VALUES ($1, $2, $3)
  //        ON CONFLICT (email) DO NOTHING`,
  //   [SEED_USER_ID, 'seed@example.com', SEED_PASSWORD_HASH],
  // );

  logger.info({ event: 'seed_test_complete' }, 'Test database seed complete');
}

try {
  await seedTestData();
  await pool.end();
  process.exit(0);
} catch (err) {
  logger.error({ err, event: 'seed_test_failed' }, 'Test database seed failed');
  await pool.end();
  process.exit(1);
}
