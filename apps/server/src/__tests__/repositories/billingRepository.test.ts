import { mockResult } from 'app/__tests__/helpers/mockResult.js';
import { uuid } from 'app/__tests__/helpers/uuids.js';
import { createBillingRepo } from 'app/repositories/billingRepository.js';
import type { BillingRepoDeps } from 'app/repositories/billingRepository.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Inject a fake query rather than mocking the pool module.
const mockQuery = vi.fn();
const { getSubscriptionByStripeSubscriptionId, getSubscriptionByUserId } =
  createBillingRepo({ query: mockQuery } as unknown as BillingRepoDeps);

const EXPECTED_COLUMNS = [
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
];

describe('billing repository', () => {
  const userId = uuid();
  const stripeSubscriptionId = 'sub_test123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSubscriptionByUserId', () => {
    it('returns subscription row when found', async () => {
      const row = {
        cancel_at_period_end: false,
        created_at: new Date(),
        current_period_end: null,
        current_period_start: null,
        id: uuid(),
        plan_id: null,
        status: 'active',
        stripe_customer_id: 'cus_test',
        stripe_subscription_id: stripeSubscriptionId,
        updated_at: new Date(),
        user_id: userId,
      };
      mockQuery.mockResolvedValueOnce(mockResult([row]));

      const result = await getSubscriptionByUserId(userId);

      expect(result).toEqual(row);
    });

    it('returns null when no subscription found', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([]));

      const result = await getSubscriptionByUserId(userId);

      expect(result).toBeNull();
    });

    it('does not use SELECT * in the query', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([]));

      await getSubscriptionByUserId(userId);

      const calledQuery = mockQuery.mock.calls[0]?.[0] as string;
      expect(calledQuery).not.toContain('SELECT *');
      for (const col of EXPECTED_COLUMNS) {
        expect(calledQuery).toContain(col);
      }
    });
  });

  describe('getSubscriptionByStripeSubscriptionId', () => {
    it('returns subscription row when found', async () => {
      const row = {
        cancel_at_period_end: false,
        created_at: new Date(),
        current_period_end: null,
        current_period_start: null,
        id: uuid(),
        plan_id: null,
        status: 'active',
        stripe_customer_id: 'cus_test',
        stripe_subscription_id: stripeSubscriptionId,
        updated_at: new Date(),
        user_id: userId,
      };
      mockQuery.mockResolvedValueOnce(mockResult([row]));

      const result =
        await getSubscriptionByStripeSubscriptionId(stripeSubscriptionId);

      expect(result).toEqual(row);
    });

    it('returns null when no subscription found', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([]));

      const result =
        await getSubscriptionByStripeSubscriptionId(stripeSubscriptionId);

      expect(result).toBeNull();
    });

    it('does not use SELECT * in the query', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([]));

      await getSubscriptionByStripeSubscriptionId(stripeSubscriptionId);

      const calledQuery = mockQuery.mock.calls[0]?.[0] as string;
      expect(calledQuery).not.toContain('SELECT *');
      for (const col of EXPECTED_COLUMNS) {
        expect(calledQuery).toContain(col);
      }
    });
  });
});
