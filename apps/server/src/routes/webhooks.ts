import { githubWebhookHandler } from 'app/handlers/webhooks/github.js';
import { Router } from 'express';

const router = Router();

router.post('/github', githubWebhookHandler);

export { router as webhooksRouter };
