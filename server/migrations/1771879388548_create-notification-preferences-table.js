/**
 * Create notification_channel and notification_event_type enums, and notification_preferences table.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createType("notification_channel", ["sms", "email", "slack", "discord", "push"]);
  pgm.createType("notification_event_type", [
    "incident_created",
    "incident_resolved",
    "tls_warning",
    "ci_failure",
    "daily_digest",
  ]);

  pgm.createTable("notification_preferences", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    channel: { type: "notification_channel", notNull: true },
    event_type: { type: "notification_event_type", notNull: true },
    enabled: { type: "bool", notNull: true, default: true },
    quiet_hours_start: { type: "time" },
    quiet_hours_end: { type: "time" },
    cooldown_minutes: { type: "int", default: 30 },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
  });

  pgm.sql(`
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.sql("DROP TRIGGER IF EXISTS set_updated_at ON notification_preferences;");
  pgm.dropTable("notification_preferences");
  pgm.dropType("notification_event_type");
  pgm.dropType("notification_channel");
};
