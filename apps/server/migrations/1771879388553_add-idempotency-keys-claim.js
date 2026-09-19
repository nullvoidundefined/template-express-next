/**
 * Turns idempotency_keys rows into claims. A request inserts its row in status
 * 'in_progress' before the handler runs, with the request fingerprint (method,
 * path, body hash) that binds the key to one request; the row becomes
 * 'completed' with the stored response when the handler answers below 500, and
 * is deleted when it fails. status_code and response_body are therefore null
 * while a claim is in progress. Existing rows are completed responses without a
 * fingerprint. has_json_body records whether a JSON body was sent, because a
 * nullable jsonb column cannot tell SQL NULL from a JSON null once read back.
 * Requires the idempotency_keys table to exist.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.addColumns('idempotency_keys', {
    // Existing rows were all JSON responses, so the column is backfilled true
    // and then defaults to false for new claims until a JSON body is stored.
    has_json_body: { default: true, notNull: true, type: 'boolean' },
    request_body_hash: { type: 'text' },
    request_method: { type: 'text' },
    request_path: { type: 'text' },
    status: {
      check: "status IN ('in_progress', 'completed')",
      default: 'completed',
      notNull: true,
      type: 'text',
    },
  });
  pgm.alterColumn('idempotency_keys', 'has_json_body', { default: false });
  pgm.alterColumn('idempotency_keys', 'status_code', { notNull: false });
  pgm.alterColumn('idempotency_keys', 'response_body', { notNull: false });
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  // Rows that cannot satisfy the restored NOT NULL constraints (claims still in
  // progress, and completed responses with no body such as a 204) are deleted
  // first; losing them only means those keys are no longer deduplicated.
  pgm.sql(`
    DELETE FROM idempotency_keys
    WHERE status = 'in_progress' OR status_code IS NULL OR response_body IS NULL
  `);
  pgm.alterColumn('idempotency_keys', 'response_body', { notNull: true });
  pgm.alterColumn('idempotency_keys', 'status_code', { notNull: true });
  pgm.dropColumns('idempotency_keys', [
    'has_json_body',
    'request_body_hash',
    'request_method',
    'request_path',
    'status',
  ]);
};
