import { env } from 'app/config/env.js';
import { getStripe } from 'app/services/stripe.js';
import type { Request, Response } from 'express';

async function createCheckoutSession(
  req: Request,
  res: Response,
): Promise<void> {
  const { priceId } = req.body as { priceId?: string };

  if (!priceId) {
    res.status(400).json({ error: { message: 'priceId is required' } });
    return;
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    cancel_url: `${env.CORS_ORIGIN}/settings?canceled=true`,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { userId: req.user!.id },
    mode: 'subscription',
    success_url: `${env.CORS_ORIGIN}/settings?session_id={CHECKOUT_SESSION_ID}`,
  });

  res.json({ data: { url: session.url } });
}

export { createCheckoutSession };
