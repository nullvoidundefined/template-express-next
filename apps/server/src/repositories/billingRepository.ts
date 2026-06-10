import type { PoolClient } from 'app/database/databasePool.js';
import type { QueryResult, QueryResultRow } from 'pg';

/**
 * Data-access dependency injected so tests can supply a fake query without
 * mocking the pool module. Mirrors `app/database/databasePool.js`'s query signature.
 */
interface BillingRepoDeps {
  query: <T extends QueryResultRow>(
    text: string,
    values?: unknown[],
    client?: PoolClient,
  ) => Promise<QueryResult<T>>;
}

const SUBSCRIPTION_COLUMNS = [
  'cancel_at_period_end',
  'created_at',
  'current_period_end',
  'current_period_start',
  'id',
  'plan_id',
  'status',
  'stripe_customer_id',
  'stripe_subscription_id',
  'updated_at',
  'user_id',
].join(', ');

function createBillingRepo({ query }: BillingRepoDeps) {
  async function getSubscriptionByUserId(
    userId: string,
  ): Promise<Record<string, unknown> | null> {
    const result = await query(
      `SELECT ${SUBSCRIPTION_COLUMNS} FROM subscriptions WHERE user_id = $1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async function getSubscriptionByStripeSubscriptionId(
    subscriptionId: string,
  ): Promise<Record<string, unknown> | null> {
    const result = await query(
      `SELECT ${SUBSCRIPTION_COLUMNS} FROM subscriptions WHERE stripe_subscription_id = $1`,
      [subscriptionId],
    );
    return result.rows[0] ?? null;
  }

  async function upsertSubscription(params: {
    cancel_at_period_end?: boolean;
    current_period_end?: string;
    current_period_start?: string;
    plan_id?: string;
    status: string;
    stripe_customer_id: string;
    stripe_subscription_id: string;
    user_id: string;
  }): Promise<Record<string, unknown>> {
    const result = await query(
      `INSERT INTO subscriptions (
      user_id, stripe_customer_id, stripe_subscription_id,
      status, plan_id, current_period_start, current_period_end,
      cancel_at_period_end
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (user_id) DO UPDATE SET
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      status = EXCLUDED.status,
      plan_id = COALESCE(EXCLUDED.plan_id, subscriptions.plan_id),
      current_period_start = COALESCE(EXCLUDED.current_period_start, subscriptions.current_period_start),
      current_period_end = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end),
      cancel_at_period_end = COALESCE(EXCLUDED.cancel_at_period_end, subscriptions.cancel_at_period_end)
    RETURNING ${SUBSCRIPTION_COLUMNS}`,
      [
        params.user_id,
        params.stripe_customer_id,
        params.stripe_subscription_id,
        params.status,
        params.plan_id ?? null,
        params.current_period_start ?? null,
        params.current_period_end ?? null,
        params.cancel_at_period_end ?? false,
      ],
    );
    return result.rows[0] as Record<string, unknown>;
  }

  async function updateSubscriptionStatus(
    stripeSubscriptionId: string,
    status: string,
    cancelAtPeriodEnd?: boolean,
  ): Promise<void> {
    await query(
      `UPDATE subscriptions
     SET status = $1, cancel_at_period_end = COALESCE($3, cancel_at_period_end)
     WHERE stripe_subscription_id = $2`,
      [status, stripeSubscriptionId, cancelAtPeriodEnd ?? null],
    );
  }

  async function claimStripeEvent(
    eventId: string,
    eventType: string,
  ): Promise<boolean> {
    const result = await query(
      `INSERT INTO stripe_events (event_id, event_type, status)
     VALUES ($1, $2, 'processing')
     ON CONFLICT (event_id) DO NOTHING
     RETURNING event_id`,
      [eventId, eventType],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async function markStripeEventProcessed(eventId: string): Promise<void> {
    await query(
      `UPDATE stripe_events SET status = 'processed', processed_at = NOW() WHERE event_id = $1`,
      [eventId],
    );
  }

  async function markStripeEventFailed(eventId: string): Promise<void> {
    await query(
      `UPDATE stripe_events SET status = 'failed' WHERE event_id = $1`,
      [eventId],
    );
  }

  return {
    claimStripeEvent,
    getSubscriptionByStripeSubscriptionId,
    getSubscriptionByUserId,
    markStripeEventFailed,
    markStripeEventProcessed,
    updateSubscriptionStatus,
    upsertSubscription,
  };
}

type BillingRepo = ReturnType<typeof createBillingRepo>;

export { createBillingRepo };
export type { BillingRepo, BillingRepoDeps };
