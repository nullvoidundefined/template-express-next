import { env } from 'app/config/envConfig.js';
import Stripe from 'stripe';

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const key = env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        'STRIPE_SECRET_KEY is not set. Stripe operations are unavailable.',
      );
    }
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export { getStripe };
