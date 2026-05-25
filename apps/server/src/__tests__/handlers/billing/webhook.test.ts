import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

vi.mock('app/services/stripe.js', () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: vi.fn().mockReturnValue({
        data: { object: {} },
        id: 'evt_test_123',
        type: 'invoice.payment_succeeded',
      }),
    },
  }),
}));

vi.mock('app/repositories/billing.js', () => ({
  claimStripeEvent: vi.fn().mockResolvedValue(true),
  markStripeEventFailed: vi.fn(),
  markStripeEventProcessed: vi.fn(),
}));

vi.mock('app/services/billing.service.js', () => ({
  onCheckoutCompleted: vi.fn(),
  onPaymentFailed: vi.fn(),
  onPaymentSucceeded: vi.fn().mockResolvedValue(undefined),
  onSubscriptionDeleted: vi.fn(),
  onSubscriptionUpdated: vi.fn(),
}));

describe('handleWebhook', () => {
  it('returns 400 when signature is missing', async () => {
    const { handleWebhook } =
      await import('../../../handlers/billing/webhook.js');
    const req = { headers: {} } as Request;
    const res = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    } as unknown as Response;

    await handleWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
