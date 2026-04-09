/**
 * Create workflow_run_status enum and github_status table.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createType('workflow_run_status', [
    'success',
    'failure',
    'pending',
    'cancelled',
  ]);

  pgm.createTable('github_status', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    service_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
      references: 'services',
      onDelete: 'CASCADE',
    },
    last_commit_sha: { type: 'varchar(40)' },
    last_commit_message: { type: 'text' },
    last_commit_author: { type: 'varchar(255)' },
    last_commit_at: { type: 'timestamptz' },
    workflow_name: { type: 'varchar(255)' },
    workflow_status: { type: 'workflow_run_status' },
    workflow_run_url: { type: 'text' },
    build_logs_excerpt: { type: 'text' },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.sql(`
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON github_status
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.sql('DROP TRIGGER IF EXISTS set_updated_at ON github_status;');
  pgm.dropTable('github_status');
  pgm.dropType('workflow_run_status');
};
