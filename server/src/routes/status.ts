import { Router } from "express";
import type { Request, Response } from "express";

import * as checksRepo from "app/repositories/checks/checks.js";
import * as servicesRepo from "app/repositories/services/services.js";
import { parseIdParam } from "app/utils/parsers/parseIdParam.js";

const router = Router();

router.get("/", async (_req: Request, res: Response): Promise<void> => {
  const services = await servicesRepo.listServices();

  const statusItems = await Promise.all(
    services.map(async (service) => {
      const latestCheck = await checksRepo.getLatestCheck(service.id);
      const uptime30d = await checksRepo.getUptimePercent(service.id, 30);
      return {
        id: service.id,
        name: service.name,
        url: service.url,
        status: latestCheck?.status ?? "down",
        uptime_30d: uptime30d,
        last_checked_at: latestCheck?.checked_at ?? null,
        response_time_ms: latestCheck?.response_time_ms ?? null,
      };
    }),
  );

  const overallStatus = statusItems.every((s) => s.status === "up")
    ? "operational"
    : statusItems.some((s) => s.status === "down")
      ? "outage"
      : "degraded";

  res.json({
    data: {
      status: overallStatus,
      services: statusItems,
      updated_at: new Date().toISOString(),
    },
  });
});

router.get("/:serviceId", async (req: Request, res: Response): Promise<void> => {
  const serviceId = parseIdParam(req.params["serviceId"]);
  if (!serviceId) {
    res.status(400).json({ error: { message: "Invalid service ID" } });
    return;
  }

  const service = await servicesRepo.getServiceById(serviceId);
  if (!service) {
    res.status(404).json({ error: { message: "Service not found" } });
    return;
  }

  const latestCheck = await checksRepo.getLatestCheck(serviceId);
  const uptime30d = await checksRepo.getUptimePercent(serviceId, 30);
  const uptime90d = await checksRepo.getUptimePercent(serviceId, 90);
  const dailyUptime = await checksRepo.getDailyUptime(serviceId, 30);

  res.json({
    data: {
      id: service.id,
      name: service.name,
      url: service.url,
      status: latestCheck?.status ?? "down",
      uptime_30d: uptime30d,
      uptime_90d: uptime90d,
      daily_uptime: dailyUptime,
      last_checked_at: latestCheck?.checked_at ?? null,
      response_time_ms: latestCheck?.response_time_ms ?? null,
      tls_valid: latestCheck?.tls_valid ?? null,
      tls_expires_at: latestCheck?.tls_expires_at ?? null,
    },
  });
});

export { router as statusRouter };
