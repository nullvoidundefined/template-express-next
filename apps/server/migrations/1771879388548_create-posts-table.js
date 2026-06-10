/**
 * Create the posts table: per-user authored content with title + body.
 * Requires the users table and the set_updated_at() trigger function
 * (both created in the users migration).
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable('posts', {
    body: { type: 'text', notNull: true },
    created_at: {
      default: pgm.func('NOW()'),
      notNull: true,
      type: 'timestamptz',
    },
    id: {
      default: pgm.func('gen_random_uuid()'),
      primaryKey: true,
      type: 'uuid',
    },
    title: { notNull: true, type: 'varchar(255)' },
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
    },
  });

  pgm.createIndex('posts', 'user_id');
  pgm.createIndex('posts', 'created_at');

  pgm.createTrigger('posts', 'set_updated_at', {
    function: 'set_updated_at',
    level: 'ROW',
    operation: 'UPDATE',
    when: 'BEFORE',
  });
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropTable('posts');
};
