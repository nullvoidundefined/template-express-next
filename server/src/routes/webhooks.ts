import { Router } from "express";

import { githubWebhookHandler } from "app/handlers/webhooks/github.js";

const router = Router();

router.post("/github", githubWebhookHandler);

export { router as webhooksRouter };
