import { createWebhookHandler } from 'app/handlers/billing/webhookHandler.js';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

// Inject fakes rather than mocking the repo, service, and stripe modules.
const handleWebhook = createWebhookHandler({
  billingRepo: {
    claimStripeEvent: vi.fn(),
    markStripeEventFailed: vi.fn(),
    markStripeEventProcessed: vi.fn(),
  },
  billingService: {
    onCheckoutCompleted: vi.fn(),
    onPaymentFailed: vi.fn(),
    onPaymentSucceeded: vi.fn(),
    onSubscriptionDeleted: vi.fn(),
    onSubscriptionUpdated: vi.fn(),
  },
  getStripe: vi.fn(),
} as unknown as Parameters<typeof createWebhookHandler>[0]);

describe('handleWebhook', () => {
  it('returns 400 when signature is missing', async () => {
    const req = { headers: {} } as Request;
    const res = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    } as unknown as Response;

    await handleWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
