import { Router } from "express";

import * as checksHandlers from "app/handlers/checks/checks.js";
import * as incidentsHandlers from "app/handlers/incidents/incidents.js";
import { getScreenshotHandler } from "app/handlers/screenshots/screenshots.js";
import * as servicesHandlers from "app/handlers/services/services.js";
import { requireAuth } from "app/middleware/requireAuth/requireAuth.js";

const router = Router();

router.get("/", servicesHandlers.listServices);
router.post("/", servicesHandlers.createService);
router.get("/:id", servicesHandlers.getService);
router.put("/:id", servicesHandlers.updateService);
router.delete("/:id", servicesHandlers.deleteService);

// Screenshot endpoint
router.get("/:id/screenshot", requireAuth, getScreenshotHandler);

// Check endpoints
router.get("/:id/checks/latest", checksHandlers.getLatestCheck);
router.get("/:id/checks", checksHandlers.getCheckHistory);
router.post("/:id/check", checksHandlers.triggerCheck);

// Incident endpoints
router.get("/:id/incidents", incidentsHandlers.listIncidents);
router.post("/:id/incidents", incidentsHandlers.createIncident);

export { router as servicesRouter };
