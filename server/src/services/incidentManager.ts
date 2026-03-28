import { Redis as IORedis } from "ioredis";

import { redisConfig } from "app/config/redis.js";
import {
  createIncident,
  getActiveIncident,
  resolveIncident,
} from "app/repositories/incidents/incidents.js";
import { dispatch } from "app/services/notifications/dispatcher.js";
import { logger } from "app/utils/logs/logger.js";

const redis = new IORedis(redisConfig.url, { maxRetriesPerRequest: null });

const FAILURE_THRESHOLD = 3; // consecutive failures before incident
const RECOVERY_THRESHOLD = 2; // consecutive successes to resolve

export async function handleIncidentLogic(
  service: { id: string; name: string; url: string },
  checkResult: { status: "up" | "degraded" | "down"; error_message?: string | null },
): Promise<void> {
  const failKey = `failures:${service.id}`;
  const successKey = `successes:${service.id}`;

  if (checkResult.status === "down") {
    const failures = await redis.incr(failKey);
    await redis.del(successKey);

    if (failures === FAILURE_THRESHOLD) {
      const existing = await getActiveIncident(service.id);
      if (!existing) {
        const incident = await createIncident(service.id, {
          title: `${service.name} is down`,
          status: "investigating",
          cause: checkResult.error_message ?? undefined,
        });
        logger.info(
          { serviceId: service.id },
          "Auto-created incident after 3 consecutive failures",
        );

        // Rate-limit SMS: one alert per 30 minutes per service
        const rateLimitKey = `sms_cooldown:${service.id}`;
        const alreadySent = await redis.get(rateLimitKey);
        if (!alreadySent) {
          await dispatch({
            type: "incident_created",
            serviceId: service.id,
            serviceName: service.name,
            serviceUrl: service.url,
            cause: checkResult.error_message ?? null,
            incidentId: incident.id,
          });
          await redis.set(rateLimitKey, "1", "EX", 1800); // 30 min cooldown
        }
      }
    }
  } else if (checkResult.status === "up") {
    const successes = await redis.incr(successKey);
    await redis.del(failKey);

    if (successes >= RECOVERY_THRESHOLD) {
      const incident = await getActiveIncident(service.id);
      if (incident) {
        await resolveIncident(incident.id);
        await redis.del(successKey);
        logger.info(
          { serviceId: service.id, incidentId: incident.id },
          "Auto-resolved incident after recovery",
        );

        // Calculate outage duration
        const startedAt = new Date(incident.started_at).getTime();
        const durationMinutes = Math.round((Date.now() - startedAt) / (1000 * 60));

        await dispatch({
          type: "incident_resolved",
          serviceId: service.id,
          serviceName: service.name,
          serviceUrl: service.url,
          durationMinutes,
        });
      }
    }
  } else {
    // degraded: reset failure counter, don't create incident
    await redis.del(failKey);
  }
}
