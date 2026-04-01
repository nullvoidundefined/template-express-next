import { Router } from "express";
import type { Request, Response } from "express";

import * as checksRepo from "app/repositories/checks/checks.js";
import * as servicesRepo from "app/repositories/services/services.js";

const router = Router();

router.get("/", async (_req: Request, res: Response): Promise<void> => {
  const services = await servicesRepo.listServices();

  const metrics = await Promise.all(
    services.map(async (service) => {
      const uptime30d = await checksRepo.getUptimePercent(service.id, 30);
      const uptime90d = await checksRepo.getUptimePercent(service.id, 90);

      const result = await import("app/db/pool/pool.js").then(({ query }) =>
        query<{ avg_response_time_ms: string | null }>(
          `SELECT ROUND(AVG(response_time_ms), 2)::text AS avg_response_time_ms
           FROM checks
           WHERE service_id = $1 AND checked_at > now() - interval '24 hours'`,
          [service.id],
        ),
      );
      const avgResponseTime = result.rows[0]?.avg_response_time_ms
        ? parseFloat(result.rows[0].avg_response_time_ms)
        : null;

      return {
        service_id: service.id,
        name: service.name,
        uptime_30d: uptime30d,
        uptime_90d: uptime90d,
        avg_response_time_ms_24h: avgResponseTime,
      };
    }),
  );

  res.json({ data: metrics });
});

export { router as metricsRouter };
