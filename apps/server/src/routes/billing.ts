import * as billingHandlers from 'app/handlers/billing/billing.js';
import * as portalHandlers from 'app/handlers/billing/portal.js';
import { requireAuth } from 'app/middleware/requireAuth/requireAuth.js';
import { Router } from 'express';

const billingRouter = Router();

billingRouter.use(requireAuth);
billingRouter.post('/checkout', billingHandlers.createCheckoutSession);
billingRouter.post('/portal', portalHandlers.createPortalSession);

export { billingRouter };
