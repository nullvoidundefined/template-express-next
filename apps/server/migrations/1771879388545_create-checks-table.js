/**
 * Create check_status enum and checks table.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createType('check_status', ['up', 'degraded', 'down']);

  pgm.createTable('checks', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    service_id: {
      type: 'uuid',
      notNull: true,
      references: 'services',
      onDelete: 'CASCADE',
    },
    status: { type: 'check_status', notNull: true },
    status_code: { type: 'int' },
    response_time_ms: { type: 'int' },
    dns_time_ms: { type: 'int' },
    tls_valid: { type: 'bool' },
    tls_expires_at: { type: 'timestamptz' },
    error_message: { type: 'text' },
    screenshot_path: { type: 'text' },
    raw_response_body: { type: 'text' },
    checked_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('checks', ['service_id', 'checked_at'], {
    order: { checked_at: 'DESC' },
  });
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropTable('checks');
  pgm.dropType('check_status');
};
