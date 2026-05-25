import * as billingRepo from 'app/repositories/billing.js';
import { logger } from 'app/utils/logs/logger.js';
import type Stripe from 'stripe';

async function onCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.metadata?.userId;
  if (!userId) {
    logger.error(
      { sessionId: session.id },
      'checkout.session.completed: no userId in metadata',
    );
    return;
  }

  const subscription = session.subscription as string | null;
  const customer = session.customer as string | null;

  if (!subscription || !customer) {
    logger.error(
      { sessionId: session.id },
      'checkout.session.completed: missing subscription or customer',
    );
    return;
  }

  await billingRepo.upsertSubscription({
    status: 'active',
    stripe_customer_id: customer,
    stripe_subscription_id: subscription,
    user_id: userId,
  });

  logger.info({ userId }, 'Subscription created via checkout');
}

async function onSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
  await billingRepo.updateSubscriptionStatus(
    sub.id,
    sub.status,
    sub.cancel_at_period_end,
  );
  logger.info(
    { status: sub.status, subscriptionId: sub.id },
    'Subscription updated',
  );
}

async function onSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  await billingRepo.updateSubscriptionStatus(sub.id, 'canceled');
  logger.info({ subscriptionId: sub.id }, 'Subscription canceled');
}

async function onPaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const subId = (invoice as unknown as { subscription: string | null })
    .subscription;
  if (!subId) return;

  const existing =
    await billingRepo.getSubscriptionByStripeSubscriptionId(subId);
  if (!existing) return;

  const period = invoice.lines?.data?.[0]?.period;
  if (period) {
    await billingRepo.upsertSubscription({
      current_period_end: new Date(period.end * 1000).toISOString(),
      current_period_start: new Date(period.start * 1000).toISOString(),
      status: 'active',
      stripe_customer_id: existing.stripe_customer_id as string,
      stripe_subscription_id: subId,
      user_id: existing.user_id as string,
    });
  }

  logger.info({ subscriptionId: subId }, 'Payment succeeded, period updated');
}

async function onPaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const subId = (invoice as unknown as { subscription: string | null })
    .subscription;
  if (!subId) return;
  await billingRepo.updateSubscriptionStatus(subId, 'past_due');
  logger.info({ subscriptionId: subId }, 'Payment failed, marked past_due');
}

export {
  onCheckoutCompleted,
  onPaymentFailed,
  onPaymentSucceeded,
  onSubscriptionDeleted,
  onSubscriptionUpdated,
};
