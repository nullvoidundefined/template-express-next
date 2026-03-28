/**
 * Create service_status enum and services table.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createType("service_status", ["up", "degraded", "down"]);

  pgm.createTable("services", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    name: { type: "varchar(255)", notNull: true },
    url: { type: "text", notNull: true },
    health_endpoint: { type: "text" },
    github_owner: { type: "varchar(255)" },
    github_repo: { type: "varchar(255)" },
    github_branch: { type: "varchar(100)", notNull: true, default: "main" },
    check_interval_seconds: { type: "int", notNull: true, default: 60 },
    timeout_ms: { type: "int", notNull: true, default: 10000 },
    expected_status_code: { type: "int", notNull: true, default: 200 },
    screenshot_enabled: { type: "bool", notNull: true, default: true },
    tags: { type: "text[]", notNull: true, default: pgm.func("'{}'") },
    created_at: { type: "timestamptz", default: pgm.func("NOW()") },
    updated_at: { type: "timestamptz", default: pgm.func("NOW()") },
  });

  pgm.sql(`
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.sql("DROP TRIGGER IF EXISTS set_updated_at ON services;");
  pgm.dropTable("services");
  pgm.dropType("service_status");
};
