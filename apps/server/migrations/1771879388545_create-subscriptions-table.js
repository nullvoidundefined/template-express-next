/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const up = (pgm) => {
  pgm.createType('subscription_status', {
    values: [
      'active',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'past_due',
      'paused',
      'trialing',
      'unpaid',
    ],
  });

  pgm.createTable('subscriptions', {
    cancel_at_period_end: { default: false, notNull: true, type: 'boolean' },
    created_at: {
      default: pgm.func('NOW()'),
      notNull: true,
      type: 'timestamptz',
    },
    current_period_end: { type: 'timestamptz' },
    current_period_start: { type: 'timestamptz' },
    id: {
      default: pgm.func('gen_random_uuid()'),
      primaryKey: true,
      type: 'uuid',
    },
    plan_id: { type: 'varchar(255)' },
    status: {
      default: 'incomplete',
      notNull: true,
      type: 'subscription_status',
    },
    stripe_customer_id: { type: 'varchar(255)', unique: true },
    stripe_subscription_id: { type: 'varchar(255)', unique: true },
    updated_at: {
      default: pgm.func('NOW()'),
      notNull: true,
      type: 'timestamptz',
    },
    user_id: {
      notNull: true,
      onDelete: 'CASCADE',
      references: 'users',
      type: 'uuid',
      unique: true,
    },
  });

  pgm.createIndex('subscriptions', 'user_id');
  pgm.createIndex('subscriptions', 'stripe_customer_id');
  pgm.createIndex('subscriptions', 'stripe_subscription_id');

  pgm.createTrigger('subscriptions', 'set_updated_at', {
    function: 'set_updated_at',
    level: 'ROW',
    operation: 'UPDATE',
    when: 'BEFORE',
  });
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const down = (pgm) => {
  pgm.dropTable('subscriptions');
  pgm.dropType('subscription_status');
};
