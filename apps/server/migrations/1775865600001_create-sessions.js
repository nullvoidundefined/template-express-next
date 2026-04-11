/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable('sessions', {
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
    token_hash: { notNull: true, type: 'text', unique: true },
    expires_at: { notNull: true, type: 'timestamptz' },
    created_at: {
      default: pgm.func('NOW()'),
      notNull: true,
      type: 'timestamptz',
    },
  });

  pgm.createIndex('sessions', 'token_hash');
  pgm.createIndex('sessions', 'user_id');
  pgm.createIndex('sessions', 'expires_at');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable('sessions');
};
