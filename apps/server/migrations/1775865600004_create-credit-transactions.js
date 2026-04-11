/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable('credit_transactions', {
    id: {
      default: pgm.func('gen_random_uuid()'),
      primaryKey: true,
      type: 'uuid',
    },
    user_id: {
      notNull: true,
      onDelete: 'CASCADE',
      references: 'users',
      type: 'uuid',
    },
    amount: { notNull: true, type: 'integer' },
    balance_after: { notNull: true, type: 'integer' },
    description: { notNull: true, type: 'text' },
    source: { notNull: true, type: 'text' },
    stripe_payment_id: { type: 'text' },
    created_at: {
      default: pgm.func('NOW()'),
      notNull: true,
      type: 'timestamptz',
    },
  });

  pgm.createIndex('credit_transactions', 'user_id');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable('credit_transactions');
};
