/**
 * Create the idempotency_keys table for safe POST/PUT retries. A stored
 * response is replayed when the same (key, user_id) is seen again within the
 * TTL window. Requires the users table to exist.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable(
    'idempotency_keys',
    {
      created_at: {
        default: pgm.func('NOW()'),
        notNull: true,
        type: 'timestamptz',
      },
      key: { notNull: true, type: 'text' },
      response_body: { notNull: true, type: 'jsonb' },
      status_code: { notNull: true, type: 'integer' },
      user_id: {
        notNull: true,
        onDelete: 'CASCADE',
        references: 'users',
        type: 'uuid',
      },
    },
    {
      constraints: {
        primaryKey: ['key', 'user_id'],
      },
    },
  );

  // Supports TTL pruning of expired keys.
  pgm.createIndex('idempotency_keys', 'created_at');
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropTable('idempotency_keys');
};
