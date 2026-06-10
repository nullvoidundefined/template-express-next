import { env } from 'app/config/envConfig.js';
import {
  ERROR_CODES,
  createErrorResponse,
} from 'app/constants/errorCodesConstants.js';
import { HTTP } from 'app/constants/httpConstants.js';
import type { BillingRepo } from 'app/repositories/billingRepository.js';
import type { BillingService } from 'app/services/billingService.js';
import { logger } from 'app/services/loggerService.js';
import type { Request, Response } from 'express';
import type Stripe from 'stripe';

interface WebhookHandlerDeps {
  billingRepo: Pick<
    BillingRepo,
    'claimStripeEvent' | 'markStripeEventFailed' | 'markStripeEventProcessed'
  >;
  billingService: BillingService;
  getStripe: () => Stripe;
}

const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.deleted',
  'customer.subscription.updated',
  'invoice.payment_failed',
  'invoice.payment_succeeded',
]);

function createWebhookHandler({
  billingRepo,
  billingService,
  getStripe,
}: WebhookHandlerDeps) {
  return async function handleWebhook(
    req: Request,
    res: Response,
  ): Promise<void> {
    const sig = req.headers['stripe-signature'] as string | undefined;
    const secret = env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !secret) {
      res
        .status(HTTP.STATUS.BAD_REQUEST)
        .json(
          createErrorResponse(
            ERROR_CODES.BILLING.WEBHOOK_MISCONFIGURED,
            'Missing signature or secret',
          ),
        );
      return;
    }

    let event;
    try {
      event = getStripe().webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      logger.error({ err }, 'Stripe webhook signature verification failed');
      res
        .status(HTTP.STATUS.BAD_REQUEST)
        .json(
          createErrorResponse(
            ERROR_CODES.BILLING.WEBHOOK_INVALID_SIGNATURE,
            'Invalid signature',
          ),
        );
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
      res
        .status(HTTP.STATUS.INTERNAL_SERVER_ERROR)
        .json(
          createErrorResponse(
            ERROR_CODES.BILLING.WEBHOOK_PROCESSING_FAILED,
            'Processing failed',
          ),
        );
      return;
    }

    res.json({ received: true });
  };
}

export { createWebhookHandler };
