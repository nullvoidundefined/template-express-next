'use client';

/**
 * Billing mutations for the dashboard: start a Stripe Checkout or open the
 * billing portal. Each resolves to the Stripe URL the caller redirects to; the
 * price is chosen by the server, so checkout sends an empty body.
 */
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';

import { api } from '@/services/apiService';

const stripeUrlResponseSchema = z.object({
  data: z.object({ url: z.string() }),
});

async function requestStripeUrl(
  path: string,
  body: Record<string, unknown>,
): Promise<string> {
  const response = await api(path, stripeUrlResponseSchema, {
    body,
    method: 'POST',
  });
  return response.data.url;
}

function useBilling() {
  const checkoutMutation = useMutation({
    mutationFn: () => requestStripeUrl('/billing/checkout', {}),
  });
  const portalMutation = useMutation({
    mutationFn: () => requestStripeUrl('/billing/portal', {}),
  });

  return {
    isCheckoutPending: checkoutMutation.isPending,
    isPortalPending: portalMutation.isPending,
    openPortal: () => portalMutation.mutateAsync(),
    startCheckout: () => checkoutMutation.mutateAsync(),
  };
}

export { useBilling };
