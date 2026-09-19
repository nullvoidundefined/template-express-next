/**
 * Data access for idempotency keys. A row is a claim on (key, user_id): it is
 * inserted in_progress with the request fingerprint before the handler runs,
 * completed with the stored response, or released (deleted) when the request
 * fails, so the middleware can replay, reject, or rerun a retried request.
 */
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

interface IdempotencyClaimInput {
  key: string;
  requestBodyHash: string;
  requestMethod: string;
  requestPath: string;
  userId: string;
}

type IdempotencyKeyStatus = 'completed' | 'in_progress';

interface StoredIdempotencyKey {
  hasJsonBody: boolean;
  requestBodyHash: string | null;
  requestMethod: string | null;
  requestPath: string | null;
  responseBody: unknown;
  status: IdempotencyKeyStatus;
  statusCode: number | null;
}

interface IdempotencyKeyRow {
  has_json_body: boolean;
  request_body_hash: string | null;
  request_method: string | null;
  request_path: string | null;
  response_body: unknown;
  status: IdempotencyKeyStatus;
  status_code: number | null;
}

const IDEMPOTENCY_KEY_COLUMNS = [
  'has_json_body',
  'request_body_hash',
  'request_method',
  'request_path',
  'response_body',
  'status',
  'status_code',
].join(', ');

const IDEMPOTENCY_TTL_HOURS = 24;

function toStoredIdempotencyKey(row: IdempotencyKeyRow): StoredIdempotencyKey {
  const {
    has_json_body: hasJsonBody,
    request_body_hash: requestBodyHash,
    request_method: requestMethod,
    request_path: requestPath,
    response_body: responseBody,
    status,
    status_code: statusCode,
  } = row;
  return {
    hasJsonBody,
    requestBodyHash,
    requestMethod,
    requestPath,
    responseBody,
    status,
    statusCode,
  };
}

function createIdempotencyRepo({ query }: IdempotencyRepoDeps) {
  // Claims the key for this request: inserts an in_progress row, or resets a
  // row older than the TTL to this request. Returns false when a live row
  // already holds the key. ON CONFLICT ... DO UPDATE takes the row lock, so two
  // simultaneous requests can never both claim it.
  async function claimKey({
    key,
    requestBodyHash,
    requestMethod,
    requestPath,
    userId,
  }: IdempotencyClaimInput): Promise<boolean> {
    const result = await query(
      `INSERT INTO idempotency_keys
         (key, user_id, request_method, request_path, request_body_hash, status)
       VALUES ($1, $2, $3, $4, $5, 'in_progress')
       ON CONFLICT (key, user_id) DO UPDATE
         SET request_method = EXCLUDED.request_method,
             request_path = EXCLUDED.request_path,
             request_body_hash = EXCLUDED.request_body_hash,
             status = 'in_progress',
             has_json_body = false,
             status_code = NULL,
             response_body = NULL,
             created_at = NOW()
         WHERE idempotency_keys.created_at < NOW() - $6 * INTERVAL '1 hour'
       RETURNING key`,
      [
        key,
        userId,
        requestMethod,
        requestPath,
        requestBodyHash,
        IDEMPOTENCY_TTL_HOURS,
      ],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async function findKey(
    key: string,
    userId: string,
  ): Promise<StoredIdempotencyKey | null> {
    const result = await query<IdempotencyKeyRow>(
      `SELECT ${IDEMPOTENCY_KEY_COLUMNS}
       FROM idempotency_keys
       WHERE key = $1 AND user_id = $2`,
      [key, userId],
    );
    const row = result.rows[0];
    return row ? toStoredIdempotencyKey(row) : null;
  }

  // A JSON body, including a JSON null, is stored as a JSON value; a response
  // without one stores SQL NULL with has_json_body false.
  async function completeKey(
    key: string,
    userId: string,
    statusCode: number,
    responseBody: unknown,
    hasJsonBody: boolean,
  ): Promise<void> {
    await query(
      `UPDATE idempotency_keys
       SET status = 'completed', status_code = $3, response_body = $4,
           has_json_body = $5
       WHERE key = $1 AND user_id = $2 AND status = 'in_progress'`,
      [
        key,
        userId,
        statusCode,
        hasJsonBody ? JSON.stringify(responseBody ?? null) : null,
        hasJsonBody,
      ],
    );
  }

  // Deletes a claim whose request failed so the client's retry runs again; a
  // completed row is never deleted here.
  async function releaseKey(key: string, userId: string): Promise<void> {
    await query(
      `DELETE FROM idempotency_keys
       WHERE key = $1 AND user_id = $2 AND status = 'in_progress'`,
      [key, userId],
    );
  }

  return { claimKey, completeKey, findKey, releaseKey };
}

type IdempotencyRepo = ReturnType<typeof createIdempotencyRepo>;

export { createIdempotencyRepo };
export type {
  IdempotencyClaimInput,
  IdempotencyRepo,
  IdempotencyRepoDeps,
  StoredIdempotencyKey,
};
