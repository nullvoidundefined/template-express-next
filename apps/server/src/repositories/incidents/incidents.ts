import { query } from 'app/db/pool/pool.js';
import type { CreateIncidentInput, Incident } from 'app/schemas/incidents.js';

export async function listIncidentsByService(
  serviceId: string,
): Promise<Incident[]> {
  const result = await query<Incident>(
    `SELECT * FROM incidents WHERE service_id = $1 ORDER BY started_at DESC`,
    [serviceId],
  );
  return result.rows;
}

export async function getIncidentById(id: string): Promise<Incident | null> {
  const result = await query<Incident>(
    `SELECT * FROM incidents WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function getActiveIncident(
  serviceId: string,
): Promise<Incident | null> {
  const result = await query<Incident>(
    `SELECT * FROM incidents WHERE service_id = $1 AND resolved_at IS NULL ORDER BY created_at DESC LIMIT 1`,
    [serviceId],
  );
  return result.rows[0] ?? null;
}

export async function createIncident(
  serviceId: string,
  data: CreateIncidentInput,
): Promise<Incident> {
  const result = await query<Incident>(
    `INSERT INTO incidents (service_id, title, cause, status, started_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      serviceId,
      data.title,
      data.cause ?? null,
      data.status,
      data.started_at ?? new Date(),
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Insert returned no row');
  return row;
}

export async function resolveIncident(id: string): Promise<Incident | null> {
  const result = await query<Incident>(
    `UPDATE incidents SET status = 'resolved', resolved_at = now() WHERE id = $1 RETURNING *`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function updateIncident(
  id: string,
  data: Partial<{
    title: string;
    cause: string | null;
    status: string;
    resolved_at: Date | null;
  }>,
): Promise<Incident | null> {
  const fields = Object.keys(data) as (keyof typeof data)[];
  if (fields.length === 0) return getIncidentById(id);

  const setClauses = fields
    .map((field, i) => `${field} = $${i + 2}`)
    .join(', ');
  const values = fields.map((field) => {
    const val = data[field];
    return val === undefined ? null : val;
  });

  const result = await query<Incident>(
    `UPDATE incidents SET ${setClauses} WHERE id = $1 RETURNING *`,
    [id, ...values],
  );
  return result.rows[0] ?? null;
}
