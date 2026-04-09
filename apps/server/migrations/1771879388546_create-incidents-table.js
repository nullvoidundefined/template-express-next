/**
 * Create incident_status enum and incidents table.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createType('incident_status', [
    'investigating',
    'identified',
    'monitoring',
    'resolved',
  ]);

  pgm.createTable('incidents', {
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
    status: {
      type: 'incident_status',
      notNull: true,
      default: 'investigating',
    },
    title: { type: 'varchar(255)', notNull: true },
    cause: { type: 'text' },
    started_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    resolved_at: { type: 'timestamptz' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.sql(`
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON incidents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.sql('DROP TRIGGER IF EXISTS set_updated_at ON incidents;');
  pgm.dropTable('incidents');
  pgm.dropType('incident_status');
};
