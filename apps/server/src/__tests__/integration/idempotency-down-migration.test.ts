// Integration test: the down migration for the idempotency claim columns
// succeeds on a table holding completed 204 rows (null response_body) and
// restores the NOT NULL constraints (I-17). It changes the schema, so it lives
// in its own file and migrates back up in afterAll, even when a test fails.
// Initial migration, TRUNCATE between tests, and pool teardown live in setup.ts.
import { query } from 'app/database/databasePool.js';
import { execSync } from 'node:child_process';
import { afterAll, describe, expect, it } from 'vitest';

const CLAIM_MIGRATION = '1771879388553_add-idempotency-keys-claim';
const DB_AVAILABLE = !!process.env.DATABASE_URL;
const MIGRATE_BIN = 'node_modules/.bin/node-pg-migrate';

function runMigration(direction: 'down 1' | 'up'): void {
  execSync(`${MIGRATE_BIN} ${direction}`, {
    env: process.env,
    stdio: 'pipe',
  });
}

async function readLatestMigration(): Promise<string | undefined> {
  const result = await query<{ name: string }>(
    'SELECT name FROM pgmigrations ORDER BY run_on DESC, id DESC LIMIT 1',
  );
  return result.rows[0]?.name;
}

async function readNullability(column: string): Promise<string | undefined> {
  const result = await query<{ is_nullable: string }>(
    `SELECT is_nullable FROM information_schema.columns
     WHERE table_name = 'idempotency_keys' AND column_name = $1`,
    [column],
  );
  return result.rows[0]?.is_nullable;
}

async function insertUserId(): Promise<string> {
  const email = `idem-down-${String(Date.now())}@example.com`;
  const result = await query<{ id: string }>(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
    [email, 'placeholder-hash-not-used-for-login'],
  );
  const [user] = result.rows;
  if (!user) {
    throw new Error('users insert returned no row');
  }
  return user.id;
}

async function readStoredKeys(): Promise<string[]> {
  const result = await query<{ key: string }>(
    'SELECT key FROM idempotency_keys ORDER BY key',
  );
  return result.rows.map((row) => row.key);
}

describe.skipIf(!DB_AVAILABLE)('idempotency claim down migration', () => {
  afterAll(() => {
    // Restores the schema for later files whether or not the down succeeded.
    runMigration('up');
  });

  it('reverts on a table holding a completed 204 row (I-17)', async () => {
    const userId = await insertUserId();
    await query(
      `INSERT INTO idempotency_keys
         (key, user_id, status, status_code, response_body)
       VALUES ($1, $2, 'completed', 204, NULL),
              ($3, $2, 'completed', 201, $4)`,
      [
        'key-stored-204',
        userId,
        'key-stored-201',
        JSON.stringify({ data: 'ok' }),
      ],
    );

    expect(await readLatestMigration()).toBe(CLAIM_MIGRATION);
    expect(() => {
      runMigration('down 1');
    }).not.toThrow();

    expect(await readNullability('response_body')).toBe('NO');
    expect(await readNullability('status_code')).toBe('NO');
    expect(await readNullability('status')).toBeUndefined();
    expect(await readStoredKeys()).toEqual(['key-stored-201']);
  });
});
