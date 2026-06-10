import { requireAuth } from 'app/middleware/requireAuthMiddleware.js';
import { validate } from 'app/middleware/validateMiddleware.js';
import { createCheckoutSchema } from 'app/schemas/billingSchema.js';
import express from 'express';
import type { RequestHandler, Router } from 'express';

interface BillingHandlers {
  createCheckoutSession: RequestHandler;
  createPortalSession: RequestHandler;
}

function createBillingRouter(handlers: BillingHandlers): Router {
  const billingRouter = express.Router();

  billingRouter.use(requireAuth);
  billingRouter.post(
    '/checkout',
    validate(createCheckoutSchema),
    handlers.createCheckoutSession,
  );
  billingRouter.post('/portal', handlers.createPortalSession);

  return billingRouter;
}

export { createBillingRouter };
export type { BillingHandlers };
