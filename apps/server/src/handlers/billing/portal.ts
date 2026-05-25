import { env } from 'app/config/env.js';
import * as billingRepo from 'app/repositories/billing.js';
import { getStripe } from 'app/services/stripe.js';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

async function createPortalSession(req: Request, res: Response): Promise<void> {
  const subscription = await billingRepo.getSubscriptionByUserId(req.user!.id);

  if (!subscription?.stripe_customer_id) {
    res.status(400).json({ error: { message: 'No billing account found' } });
    return;
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create(
    {
      customer: subscription.stripe_customer_id as string,
      return_url: `${env.CORS_ORIGIN}/settings`,
    },
    { idempotencyKey: randomUUID() },
  );

  res.json({ data: { url: session.url } });
}

export { createPortalSession };
