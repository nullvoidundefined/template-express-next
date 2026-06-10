import { env } from 'app/config/envConfig.js';
import {
  ERROR_CODES,
  createErrorResponse,
} from 'app/constants/errorCodesConstants.js';
import { HTTP } from 'app/constants/httpConstants.js';
import type { BillingRepo } from 'app/repositories/billingRepository.js';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';

interface PortalHandlerDeps {
  billingRepo: Pick<BillingRepo, 'getSubscriptionByUserId'>;
  getStripe: () => Stripe;
}

function createPortalHandler({ billingRepo, getStripe }: PortalHandlerDeps) {
  return async function createPortalSession(
    req: Request,
    res: Response,
  ): Promise<void> {
    const subscription = await billingRepo.getSubscriptionByUserId(
      req.user!.id,
    );

    if (!subscription?.stripe_customer_id) {
      res
        .status(HTTP.STATUS.BAD_REQUEST)
        .json(
          createErrorResponse(
            ERROR_CODES.BILLING.NO_ACCOUNT,
            'No billing account found',
          ),
        );
      return;
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create(
      {
        customer: subscription.stripe_customer_id as string,
        return_url: `${env.CLIENT_URL}/settings`,
      },
      { idempotencyKey: randomUUID() },
    );

    res.json({ data: { url: session.url } });
  };
}

export { createPortalHandler };
