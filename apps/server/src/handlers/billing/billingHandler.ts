import { env } from 'app/config/envConfig.js';
import type { CreateCheckoutInput } from 'app/schemas/billingSchema.js';
import type { Request, Response } from 'express';
import type Stripe from 'stripe';

interface CheckoutHandlerDeps {
  getStripe: () => Stripe;
}

function createCheckoutHandler({ getStripe }: CheckoutHandlerDeps) {
  return async function createCheckoutSession(
    req: Request,
    res: Response,
  ): Promise<void> {
    // Body is validated by the validate(createCheckoutSchema) route middleware.
    const { priceId } = req.body as CreateCheckoutInput;

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      cancel_url: `${env.CLIENT_URL}/settings?canceled=true`,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: req.user!.id },
      mode: 'subscription',
      success_url: `${env.CLIENT_URL}/settings?session_id={CHECKOUT_SESSION_ID}`,
    });

    res.json({ data: { url: session.url } });
  };
}

export { createCheckoutHandler };
