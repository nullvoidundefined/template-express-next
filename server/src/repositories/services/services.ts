import { query } from "app/db/pool/pool.js";
import type { CreateServiceInput, Service, UpdateServiceInput } from "app/schemas/services.js";

export async function listServices(): Promise<Service[]> {
  const result = await query<Service>("SELECT * FROM services ORDER BY created_at ASC");
  return result.rows;
}

export async function getServiceById(id: string): Promise<Service | null> {
  const result = await query<Service>("SELECT * FROM services WHERE id = $1", [id]);
  return result.rows[0] ?? null;
}

export async function createService(data: CreateServiceInput): Promise<Service> {
  const result = await query<Service>(
    `INSERT INTO services
      (name, url, health_endpoint, github_owner, github_repo, github_branch,
       check_interval_seconds, timeout_ms, expected_status_code, screenshot_enabled, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      data.name,
      data.url,
      data.health_endpoint ?? null,
      data.github_owner ?? null,
      data.github_repo ?? null,
      data.github_branch,
      data.check_interval_seconds,
      data.timeout_ms,
      data.expected_status_code,
      data.screenshot_enabled,
      data.tags,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Insert returned no row");
  return row;
}

export async function updateService(id: string, data: UpdateServiceInput): Promise<Service | null> {
  const fields = Object.keys(data) as (keyof UpdateServiceInput)[];
  if (fields.length === 0) {
    return getServiceById(id);
  }

  const setClauses = fields.map((field, i) => `${field} = $${i + 2}`).join(", ");
  const values = fields.map((field) => {
    const val = data[field];
    return val === undefined ? null : val;
  });

  const result = await query<Service>(
    `UPDATE services SET ${setClauses} WHERE id = $1 RETURNING *`,
    [id, ...values],
  );
  return result.rows[0] ?? null;
}

export async function deleteService(id: string): Promise<boolean> {
  const result = await query("DELETE FROM services WHERE id = $1 RETURNING id", [id]);
  return (result.rowCount ?? 0) > 0;
}
