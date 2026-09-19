// Integration test: the stripe_events claim decides whether a webhook delivery
// is processed. Stripe redelivers an event after a 500, so a delivery whose
// processing failed, or whose worker died mid-processing, must be claimable
// again, while a processed or actively processing event must not be.
// Schema migration, TRUNCATE between tests, and pool teardown live in setup.ts.
import { query } from 'app/database/databasePool.js';
import { createBillingRepo } from 'app/repositories/billingRepository.js';
import { describe, expect, it } from 'vitest';

const DB_AVAILABLE = !!process.env.DATABASE_URL;

const { claimStripeEvent, markStripeEventFailed, markStripeEventProcessed } =
  createBillingRepo({ query });

const EVENT_TYPE = 'customer.subscription.updated';

describe.skipIf(!DB_AVAILABLE)('webhook redelivery integration', () => {
  it('claims a new event once, so a concurrent duplicate delivery is skipped', async () => {
    expect(await claimStripeEvent('evt_new', EVENT_TYPE)).toBe(true);
    expect(await claimStripeEvent('evt_new', EVENT_TYPE)).toBe(false);
  });

  it('does not claim an event that was already processed', async () => {
    await claimStripeEvent('evt_processed', EVENT_TYPE);
    await markStripeEventProcessed('evt_processed');

    expect(await claimStripeEvent('evt_processed', EVENT_TYPE)).toBe(false);
  });

  it('claims a failed event again when Stripe redelivers it', async () => {
    await claimStripeEvent('evt_failed', EVENT_TYPE);
    await markStripeEventFailed('evt_failed');

    expect(await claimStripeEvent('evt_failed', EVENT_TYPE)).toBe(true);
    const { rows } = await query<{ status: string }>(
      'SELECT status FROM stripe_events WHERE event_id = $1',
      ['evt_failed'],
    );
    expect(rows[0]?.status).toBe('processing');
  });

  it('claims an event again when its processing claim has gone stale', async () => {
    await claimStripeEvent('evt_stuck', EVENT_TYPE);
    // Simulates a process that claimed the event and crashed before marking
    // it processed or failed, long enough ago that no live handler holds it.
    await query(
      `UPDATE stripe_events SET attempted_at = NOW() - INTERVAL '1 hour' WHERE event_id = $1`,
      ['evt_stuck'],
    );

    expect(await claimStripeEvent('evt_stuck', EVENT_TYPE)).toBe(true);
  });
});
