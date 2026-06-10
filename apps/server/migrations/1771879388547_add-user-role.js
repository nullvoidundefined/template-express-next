/**
 * Adds a role column to users for role-based authorization.
 * Requires the users table to exist.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.addColumn('users', {
    role: {
      type: 'text',
      notNull: true,
      default: 'user',
      check: "role IN ('user', 'admin')",
    },
  });
  pgm.createIndex('users', 'role');
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropColumn('users', 'role');
};
