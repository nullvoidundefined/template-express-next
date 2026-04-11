/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable('user_notifications_seen', {
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
    notification_key: { notNull: true, type: 'text' },
    seen_at: {
      default: pgm.func('NOW()'),
      notNull: true,
      type: 'timestamptz',
    },
  });

  pgm.addConstraint(
    'user_notifications_seen',
    'user_notifications_seen_user_notification_unique',
    {
      unique: ['user_id', 'notification_key'],
    },
  );

  pgm.createIndex('user_notifications_seen', 'user_id');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable('user_notifications_seen');
};
