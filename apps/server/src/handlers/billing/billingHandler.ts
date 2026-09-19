/**
 * Starts a Stripe Checkout session for the signed-in user. The price is the
 * server's STRIPE_PRICE_ID (the request body carries nothing, enforced by
 * createCheckoutSchema), and Stripe sends the customer back to the dashboard
 * with the checkout outcome in the query string.
 */
import type { Request, Response } from 'express';
import type Stripe from 'stripe';

import { env } from 'app/config/envConfig.js';
import {
  ERROR_CODES,
  createErrorResponse,
} from 'app/constants/errorCodesConstants.js';
import { HTTP } from 'app/constants/httpConstants.js';

interface CheckoutHandlerDeps {
  getStripe: () => Stripe;
}

function sendBillingNotConfigured(res: Response): void {
  res
    .status(HTTP.STATUS.SERVICE_UNAVAILABLE)
    .json(
      createErrorResponse(
        ERROR_CODES.BILLING.NOT_CONFIGURED,
        'Billing is not configured',
      ),
    );
}

function createCheckoutHandler({ getStripe }: CheckoutHandlerDeps) {
  return async function createCheckoutSession(
    req: Request,
    res: Response,
  ): Promise<void> {
    // The body is validated as empty by the validate(createCheckoutSchema)
    // route middleware; the price comes only from the server's config.
    const { CLIENT_URL: clientUrl, STRIPE_PRICE_ID: priceId } = env;
    if (!priceId) {
      sendBillingNotConfigured(res);
      return;
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      cancel_url: `${clientUrl}/dashboard?checkout=canceled`,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: req.user!.id },
      mode: 'subscription',
      success_url: `${clientUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    });

    res.json({ data: { url: session.url } });
  };
}

export { createCheckoutHandler };
