import { query } from "app/db/pool/pool.js";

export interface CheckAggregate {
  id: string;
  service_id: string;
  period_start: string;
  period_type: "hourly" | "daily";
  total_checks: number;
  up_checks: number;
  degraded_checks: number;
  down_checks: number;
  avg_response_time_ms: number | null;
  min_response_time_ms: number | null;
  max_response_time_ms: number | null;
  created_at: string;
}

export interface AggregateUptimeDay {
  date: string;
  uptime_percent: number | null;
  total_checks: number;
}

/**
 * Roll up checks older than `olderThanDays` days into hourly aggregates.
 * Uses ON CONFLICT DO NOTHING to be idempotent.
 */
export async function rollupHourly(olderThanDays = 30): Promise<number> {
  const result = await query<{ id: string }>(
    `INSERT INTO check_aggregates
       (service_id, period_start, period_type,
        total_checks, up_checks, degraded_checks, down_checks,
        avg_response_time_ms, min_response_time_ms, max_response_time_ms)
     SELECT
       service_id,
       date_trunc('hour', checked_at) AS period_start,
       'hourly' AS period_type,
       COUNT(*)::int AS total_checks,
       COUNT(*) FILTER (WHERE status = 'up')::int AS up_checks,
       COUNT(*) FILTER (WHERE status = 'degraded')::int AS degraded_checks,
       COUNT(*) FILTER (WHERE status = 'down')::int AS down_checks,
       ROUND(AVG(response_time_ms))::int AS avg_response_time_ms,
       MIN(response_time_ms)::int AS min_response_time_ms,
       MAX(response_time_ms)::int AS max_response_time_ms
     FROM checks
     WHERE checked_at < now() - ($1 || ' days')::interval
     GROUP BY service_id, date_trunc('hour', checked_at)
     ON CONFLICT (service_id, period_start, period_type) DO NOTHING
     RETURNING id`,
    [String(olderThanDays)],
  );
  return result.rowCount ?? 0;
}

/**
 * Roll up hourly aggregates older than `olderThanDays` days into daily aggregates.
 */
export async function rollupDaily(olderThanDays = 365): Promise<number> {
  const result = await query<{ id: string }>(
    `INSERT INTO check_aggregates
       (service_id, period_start, period_type,
        total_checks, up_checks, degraded_checks, down_checks,
        avg_response_time_ms, min_response_time_ms, max_response_time_ms)
     SELECT
       service_id,
       date_trunc('day', period_start) AS period_start,
       'daily' AS period_type,
       SUM(total_checks)::int AS total_checks,
       SUM(up_checks)::int AS up_checks,
       SUM(degraded_checks)::int AS degraded_checks,
       SUM(down_checks)::int AS down_checks,
       ROUND(SUM(avg_response_time_ms::numeric * total_checks) / NULLIF(SUM(total_checks), 0))::int AS avg_response_time_ms,
       MIN(min_response_time_ms)::int AS min_response_time_ms,
       MAX(max_response_time_ms)::int AS max_response_time_ms
     FROM check_aggregates
     WHERE period_type = 'hourly'
       AND period_start < now() - ($1 || ' days')::interval
     GROUP BY service_id, date_trunc('day', period_start)
     ON CONFLICT (service_id, period_start, period_type) DO NOTHING
     RETURNING id`,
    [String(olderThanDays)],
  );
  return result.rowCount ?? 0;
}

/**
 * Delete individual check records that have already been rolled up (older than `olderThanDays` days).
 */
export async function deleteRolledUpChecks(olderThanDays = 30): Promise<number> {
  const result = await query(
    `DELETE FROM checks WHERE checked_at < now() - ($1 || ' days')::interval`,
    [String(olderThanDays)],
  );
  return result.rowCount ?? 0;
}

/**
 * Get per-day uptime from aggregates for a service.
 * Uses daily aggregates for older data and hourly aggregates for more recent data.
 */
export async function getDailyUptimeFromAggregates(
  serviceId: string,
  days: number,
): Promise<AggregateUptimeDay[]> {
  const result = await query<{
    date: string;
    uptime_percent: string | null;
    total_checks: string;
  }>(
    `SELECT
       DATE(period_start) AS date,
       ROUND(SUM(up_checks) * 100.0 / NULLIF(SUM(total_checks), 0), 2) AS uptime_percent,
       SUM(total_checks)::text AS total_checks
     FROM check_aggregates
     WHERE service_id = $1
       AND period_start > now() - ($2 || ' days')::interval
     GROUP BY DATE(period_start)
     ORDER BY date DESC`,
    [serviceId, String(days)],
  );
  return result.rows.map((row) => ({
    date: row.date,
    uptime_percent: row.uptime_percent !== null ? parseFloat(row.uptime_percent) : null,
    total_checks: parseInt(row.total_checks, 10),
  }));
}
