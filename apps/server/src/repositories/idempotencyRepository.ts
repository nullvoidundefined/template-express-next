import type { PoolClient } from 'app/database/databasePool.js';
import type { QueryResult, QueryResultRow } from 'pg';

interface IdempotencyRepoDeps {
  query: <T extends QueryResultRow>(
    text: string,
    values?: unknown[],
    client?: PoolClient,
  ) => Promise<QueryResult<T>>;
  withTransaction: <T>(fn: (client: PoolClient) => Promise<T>) => Promise<T>;
}

interface StoredResponse {
  response_body: unknown;
  status_code: number;
}

const IDEMPOTENCY_TTL_HOURS = 24;

function createIdempotencyRepo({ query }: IdempotencyRepoDeps) {
  // Returns the stored response if this key was seen within the TTL window.
  // Parameterized integer * INTERVAL avoids interpolating raw text into SQL.
  async function findByKey(
    key: string,
    userId: string,
  ): Promise<StoredResponse | null> {
    const result = await query<StoredResponse>(
      `SELECT status_code, response_body FROM idempotency_keys
       WHERE key = $1 AND user_id = $2
       AND created_at > NOW() - $3 * INTERVAL '1 hour'`,
      [key, userId, IDEMPOTENCY_TTL_HOURS],
    );
    return result.rows[0] ?? null;
  }

  async function store(
    key: string,
    userId: string,
    statusCode: number,
    responseBody: unknown,
  ): Promise<void> {
    await query(
      'INSERT INTO idempotency_keys (key, user_id, status_code, response_body) VALUES ($1, $2, $3, $4)',
      [key, userId, statusCode, JSON.stringify(responseBody)],
    );
  }

  return { findByKey, store };
}

type IdempotencyRepo = ReturnType<typeof createIdempotencyRepo>;

export { createIdempotencyRepo };
export type { IdempotencyRepo, IdempotencyRepoDeps };
