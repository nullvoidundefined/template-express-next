/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  pgm.createTable('users', {
    id: {
      default: pgm.func('gen_random_uuid()'),
      primaryKey: true,
      type: 'uuid',
    },
    email: { notNull: true, type: 'text', unique: true },
    email_verified: { default: false, notNull: true, type: 'boolean' },
    password_hash: { type: 'text' },
    name_alias: { type: 'text' },
    name_first: { type: 'text' },
    name_last: { type: 'text' },
    created_at: {
      default: pgm.func('NOW()'),
      notNull: true,
      type: 'timestamptz',
    },
    updated_at: {
      default: pgm.func('NOW()'),
      notNull: true,
      type: 'timestamptz',
    },
  });

  pgm.createIndex('users', 'email');

  pgm.sql(`
    CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable('users');
  pgm.sql('DROP FUNCTION IF EXISTS set_updated_at CASCADE;');
};
