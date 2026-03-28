import { query } from "app/db/pool/pool.js";
import type { Check, InsertCheckInput } from "app/schemas/checks.js";

export async function insertCheck(data: InsertCheckInput): Promise<Check> {
  const result = await query<Check>(
    `INSERT INTO checks
      (service_id, status, status_code, response_time_ms, dns_time_ms,
       tls_valid, tls_expires_at, error_message, screenshot_path, raw_response_body)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.service_id,
      data.status,
      data.status_code ?? null,
      data.response_time_ms ?? null,
      data.dns_time_ms ?? null,
      data.tls_valid ?? null,
      data.tls_expires_at ?? null,
      data.error_message ?? null,
      data.screenshot_path ?? null,
      data.raw_response_body ?? null,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Insert returned no row");
  return row;
}

export async function getLatestCheck(serviceId: string): Promise<Check | null> {
  const result = await query<Check>(
    `SELECT * FROM checks WHERE service_id = $1 ORDER BY checked_at DESC LIMIT 1`,
    [serviceId],
  );
  return result.rows[0] ?? null;
}

export async function getCheckHistory(
  serviceId: string,
  limit: number,
  offset: number,
): Promise<Check[]> {
  const result = await query<Check>(
    `SELECT * FROM checks WHERE service_id = $1 ORDER BY checked_at DESC LIMIT $2 OFFSET $3`,
    [serviceId, limit, offset],
  );
  return result.rows;
}

export async function getUptimePercent(serviceId: string, days: number): Promise<number | null> {
  const result = await query<{ uptime: string | null }>(
    `SELECT ROUND(COUNT(*) FILTER (WHERE status = 'up') * 100.0 / NULLIF(COUNT(*), 0), 2) AS uptime
     FROM checks
     WHERE service_id = $1 AND checked_at > now() - ($2 || ' days')::interval`,
    [serviceId, String(days)],
  );
  const row = result.rows[0];
  if (!row || row.uptime === null) return null;
  return parseFloat(row.uptime);
}

export interface DailyUptime {
  date: string;
  uptime_percent: number | null;
  total_checks: number;
}

export async function getDailyUptime(serviceId: string, days: number): Promise<DailyUptime[]> {
  const result = await query<{ date: string; uptime_percent: string | null; total_checks: string }>(
    `SELECT
       DATE(checked_at) AS date,
       ROUND(COUNT(*) FILTER (WHERE status = 'up') * 100.0 / NULLIF(COUNT(*), 0), 2) AS uptime_percent,
       COUNT(*)::text AS total_checks
     FROM checks
     WHERE service_id = $1 AND checked_at > now() - ($2 || ' days')::interval
     GROUP BY DATE(checked_at)
     ORDER BY date DESC`,
    [serviceId, String(days)],
  );
  return result.rows.map((row) => ({
    date: row.date,
    uptime_percent: row.uptime_percent !== null ? parseFloat(row.uptime_percent) : null,
    total_checks: parseInt(row.total_checks, 10),
  }));
}
