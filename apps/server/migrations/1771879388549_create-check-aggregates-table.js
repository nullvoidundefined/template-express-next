// creates check_aggregates table for hourly rollups
exports.up = (pgm) => {
  pgm.createTable('check_aggregates', {
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
    period_start: { type: 'timestamptz', notNull: true },
    period_type: { type: 'varchar(10)', notNull: true }, // 'hourly' or 'daily'
    total_checks: { type: 'int', notNull: true },
    up_checks: { type: 'int', notNull: true },
    degraded_checks: { type: 'int', notNull: true },
    down_checks: { type: 'int', notNull: true },
    avg_response_time_ms: { type: 'int' },
    min_response_time_ms: { type: 'int' },
    max_response_time_ms: { type: 'int' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
  pgm.addConstraint(
    'check_aggregates',
    'check_aggregates_service_period_unique',
    'UNIQUE (service_id, period_start, period_type)',
  );
  pgm.createIndex('check_aggregates', ['service_id', 'period_start']);
};
exports.down = (pgm) => {
  pgm.dropTable('check_aggregates');
};
