import pg from "pg";

import { logger } from "app/utils/logs/logger.js";

const { Pool } = pg;

export type PoolClient = pg.PoolClient;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" }
      : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true" },
});

/** Instrumented query wrapper. Logs SQL text and duration in non-production environments. */
export async function query<T extends pg.QueryResultRow>(
  text: string,
  values?: unknown[],
  client?: PoolClient,
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const target = client ?? pool;
  const result =
    values !== undefined ? await target.query<T>(text, values) : await target.query<T>(text);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== "production") {
    logger.debug({ query: text, duration_ms: duration }, "db query");
  }
  return result;
}

/**
 * Runs a callback inside a database transaction. On success commits; on error rolls back and rethrows.
 * Use this when multiple operations must succeed or fail together (e.g. register = createUser + createSession).
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await query("BEGIN", undefined, client);
    const result = await fn(client);
    await query("COMMIT", undefined, client);
    return result;
  } catch (err) {
    await query("ROLLBACK", undefined, client);
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
