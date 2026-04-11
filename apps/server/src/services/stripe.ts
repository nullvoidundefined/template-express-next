import { env } from 'app/config/env.js';
import Stripe from 'stripe';

const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? '');

export { stripe };
