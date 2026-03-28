import { Router } from "express";
import type { Request, Response } from "express";

import { getScreenshotHandler } from "app/handlers/screenshots/screenshots.js";
import * as checksRepo from "app/repositories/checks/checks.js";
import * as githubRepo from "app/repositories/github/github.js";
import * as incidentsRepo from "app/repositories/incidents/incidents.js";
import * as servicesRepo from "app/repositories/services/services.js";
import { parseIdParam } from "app/utils/parsers/parseIdParam.js";

const router = Router();

router.get("/", async (_req: Request, res: Response): Promise<void> => {
  const services = await servicesRepo.listServices();

  const [serviceItems, allActiveIncidents, uptimeHistory] = await Promise.all([
    Promise.all(
      services.map(async (service) => {
        const [latestCheck, uptime30d, githubStatus] = await Promise.all([
          checksRepo.getLatestCheck(service.id),
          checksRepo.getUptimePercent(service.id, 30),
          githubRepo.getGithubStatus(service.id),
        ]);
        return {
          ...service,
          status: (latestCheck?.status ?? "down") as "up" | "degraded" | "down",
          uptime_percent_30d: uptime30d ?? 0,
          response_time_avg_30d: latestCheck?.response_time_ms ?? 0,
          last_checked_at: latestCheck?.checked_at?.toISOString?.() ?? null,
          github: githubStatus
            ? {
                ci_status: githubStatus.workflow_status,
                last_commit_at: githubStatus.last_commit_at?.toISOString?.() ?? null,
              }
            : undefined,
        };
      }),
    ),
    Promise.all(services.map((s) => incidentsRepo.getActiveIncident(s.id))).then((results) =>
      results.filter((i): i is NonNullable<typeof i> => i !== null),
    ),
    services.length > 0
      ? checksRepo.getDailyUptime(services[0]!.id, 90)
      : Promise.resolve([] as checksRepo.DailyUptime[]),
  ]);

  const overall =
    serviceItems.length === 0
      ? "operational"
      : serviceItems.every((s) => s.status === "up")
        ? "operational"
        : serviceItems.some((s) => s.status === "down")
          ? "outage"
          : "degraded";

  res.json({
    data: {
      overall,
      services: serviceItems,
      active_incidents: allActiveIncidents,
      uptime_history_90d: uptimeHistory.map((d) => ({
        date: d.date,
        uptime_percent: d.uptime_percent,
      })),
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

// Public screenshot endpoint (no auth — for public status page)
router.get("/:serviceId/screenshot", getScreenshotHandler);

export { router as statusRouter };
