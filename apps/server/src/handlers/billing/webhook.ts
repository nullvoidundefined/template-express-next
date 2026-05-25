import { env } from 'app/config/env.js';
import * as billingRepo from 'app/repositories/billing.js';
import * as billingService from 'app/services/billing.service.js';
import { getStripe } from 'app/services/stripe.js';
import { logger } from 'app/utils/logs/logger.js';
import type { Request, Response } from 'express';
import type Stripe from 'stripe';

const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.deleted',
  'customer.subscription.updated',
  'invoice.payment_failed',
  'invoice.payment_succeeded',
]);

async function handleWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'] as string | undefined;
  const secret = env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    res.status(400).json({ error: { message: 'Missing signature or secret' } });
    return;
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    logger.error({ err }, 'Stripe webhook signature verification failed');
    res.status(400).json({ error: { message: 'Invalid signature' } });
    return;
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    res.json({ received: true });
    return;
  }

  const claimed = await billingRepo.claimStripeEvent(event.id, event.type);
  if (!claimed) {
    res.json({ received: true });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await billingService.onCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case 'customer.subscription.updated':
        await billingService.onSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;
      case 'customer.subscription.deleted':
        await billingService.onSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;
      case 'invoice.payment_succeeded':
        await billingService.onPaymentSucceeded(
          event.data.object as Stripe.Invoice,
        );
        break;
      case 'invoice.payment_failed':
        await billingService.onPaymentFailed(
          event.data.object as Stripe.Invoice,
        );
        break;
    }
    await billingRepo.markStripeEventProcessed(event.id);
  } catch (err) {
    await billingRepo.markStripeEventFailed(event.id);
    logger.error(
      { err, eventId: event.id, eventType: event.type },
      'Webhook processing failed',
    );
    res.status(500).json({ error: { message: 'Processing failed' } });
    return;
  }

  res.json({ received: true });
}

export { handleWebhook };
