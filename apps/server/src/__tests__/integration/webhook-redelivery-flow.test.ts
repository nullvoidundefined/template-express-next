// Integration test: the stripe_events claim decides whether a webhook delivery
// is processed. Stripe redelivers an event after a 500, so a delivery whose
// processing failed, or whose worker died mid-processing, must be claimable
// again, while a processed or actively processing event must not be. Each
// claim returns its attempt number, and completion writes only land for the
// attempt that currently holds the claim, so a slow handler whose claim was
// taken over cannot overwrite the newer attempt's result.
// Schema migration, TRUNCATE between tests, and pool teardown live in setup.ts.
import { describe, expect, it } from 'vitest';

import { query } from 'app/database/databasePool.js';
import { createBillingRepo } from 'app/repositories/billingRepository.js';

const DB_AVAILABLE = !!process.env.DATABASE_URL;

const { claimStripeEvent, markStripeEventFailed, markStripeEventProcessed } =
  createBillingRepo({ query });

const EVENT_TYPE = 'customer.subscription.updated';

async function readEventStatus(eventId: string): Promise<string | undefined> {
  const { rows } = await query<{ status: string }>(
    'SELECT status FROM stripe_events WHERE event_id = $1',
    [eventId],
  );
  return rows[0]?.status;
}

async function makeClaimStale(eventId: string): Promise<void> {
  // Simulates a claim old enough that no healthy handler still holds it.
  await query(
    `UPDATE stripe_events SET attempted_at = NOW() - INTERVAL '1 hour' WHERE event_id = $1`,
    [eventId],
  );
}

describe.skipIf(!DB_AVAILABLE)('webhook redelivery integration', () => {
  it('lets exactly one of two concurrent deliveries claim a new event', async () => {
    const claims = await Promise.all([
      claimStripeEvent('evt_race_new', EVENT_TYPE),
      claimStripeEvent('evt_race_new', EVENT_TYPE),
    ]);

    expect(claims.filter((attempt) => attempt !== null)).toEqual([1]);
  });

  it('lets exactly one of two concurrent deliveries take over a stale claim', async () => {
    await claimStripeEvent('evt_race_stale', EVENT_TYPE);
    await makeClaimStale('evt_race_stale');

    const claims = await Promise.all([
      claimStripeEvent('evt_race_stale', EVENT_TYPE),
      claimStripeEvent('evt_race_stale', EVENT_TYPE),
    ]);

    expect(claims.filter((attempt) => attempt !== null)).toEqual([2]);
  });

  it('does not claim an event that was already processed', async () => {
    const attempt = await claimStripeEvent('evt_processed', EVENT_TYPE);
    await markStripeEventProcessed('evt_processed', attempt ?? 0);

    expect(await claimStripeEvent('evt_processed', EVENT_TYPE)).toBeNull();
  });

  it('claims a failed event again when Stripe redelivers it', async () => {
    const attempt = await claimStripeEvent('evt_failed', EVENT_TYPE);
    await markStripeEventFailed('evt_failed', attempt ?? 0);

    expect(await claimStripeEvent('evt_failed', EVENT_TYPE)).toBe(2);
    expect(await readEventStatus('evt_failed')).toBe('processing');
  });

  it('claims an event again when its processing claim has gone stale', async () => {
    await claimStripeEvent('evt_stuck', EVENT_TYPE);
    await makeClaimStale('evt_stuck');

    expect(await claimStripeEvent('evt_stuck', EVENT_TYPE)).toBe(2);
  });

  it('ignores completion writes from an attempt whose claim was taken over', async () => {
    const slowAttempt = await claimStripeEvent('evt_fenced', EVENT_TYPE);
    await makeClaimStale('evt_fenced');
    const currentAttempt = await claimStripeEvent('evt_fenced', EVENT_TYPE);

    // The slow handler finally returns; neither of its writes may land.
    await markStripeEventProcessed('evt_fenced', slowAttempt ?? 0);
    await markStripeEventFailed('evt_fenced', slowAttempt ?? 0);
    expect(await readEventStatus('evt_fenced')).toBe('processing');

    await markStripeEventProcessed('evt_fenced', currentAttempt ?? 0);
    expect(await readEventStatus('evt_fenced')).toBe('processed');
  });
});
