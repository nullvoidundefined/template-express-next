import { Router } from "express";

import { getGithubStatusHandler } from "app/handlers/github/github.js";
import { requireAuth } from "app/middleware/requireAuth/requireAuth.js";

const router = Router({ mergeParams: true });

router.get("/:id/github", requireAuth, getGithubStatusHandler);

export { router as githubRouter };
