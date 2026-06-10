/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const up = (pgm) => {
  pgm.createTable('stripe_events', {
    event_id: { notNull: true, primaryKey: true, type: 'text' },
    event_type: { notNull: true, type: 'text' },
    processed_at: {
      default: pgm.func('NOW()'),
      notNull: true,
      type: 'timestamptz',
    },
    status: { default: 'processing', notNull: true, type: 'text' },
  });
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const down = (pgm) => {
  pgm.dropTable('stripe_events');
};
