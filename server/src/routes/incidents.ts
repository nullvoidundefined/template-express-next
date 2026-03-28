import { Router } from "express";

import * as incidentsHandlers from "app/handlers/incidents/incidents.js";
import { requireAuth } from "app/middleware/requireAuth/requireAuth.js";

const router = Router();

// PUT /api/v1/incidents/:incidentId — update incident status/cause
router.put("/:incidentId", requireAuth, incidentsHandlers.updateIncidentHandler);

export { router as incidentsRouter };
