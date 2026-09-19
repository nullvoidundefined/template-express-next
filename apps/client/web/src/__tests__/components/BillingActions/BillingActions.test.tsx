import { BillingActions } from '@/components/BillingActions/BillingActions';
import { ApiError } from '@/services/apiService';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The hook is replaced by a small stateful stand-in: the tests control when
// each request settles, and the pending flags follow those requests the way
// the real hook's do, so the component may read either the flags or its own
// state.
const billingRequests = vi.hoisted(() => ({
  openPortal: vi.fn<() => Promise<string>>(),
  startCheckout: vi.fn<() => Promise<string>>(),
}));

vi.mock('@/state/useBillingHook', async () => {
  const { useState } = await import('react');
  return {
    useBilling: () => {
      const [isCheckoutPending, setCheckoutPending] = useState(false);
      const [isPortalPending, setPortalPending] = useState(false);
      return {
        isCheckoutPending,
        isPortalPending,
        openPortal: async () => {
          setPortalPending(true);
          try {
            return await billingRequests.openPortal();
          } finally {
            setPortalPending(false);
          }
        },
        startCheckout: async () => {
          setCheckoutPending(true);
          try {
            return await billingRequests.startCheckout();
          } finally {
            setCheckoutPending(false);
          }
        },
      };
    },
  };
});

const CHECKOUT_URL = 'https://checkout.stripe.test/session';
const GENERIC_ERROR = 'Something went wrong. Please try again.';
const NO_ACCOUNT_ERROR =
  "You don't have a billing account yet. Upgrade to create one.";
const PORTAL_URL = 'https://billing.stripe.test/portal';

const assign = vi.fn();

function neverSettles(): Promise<string> {
  return new Promise<string>(() => undefined);
}

describe('BillingActions', () => {
  beforeEach(() => {
    billingRequests.openPortal.mockReset();
    billingRequests.startCheckout.mockReset();
    assign.mockReset();
    vi.stubGlobal('location', { ...window.location, assign });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the browser to the checkout URL when Upgrade is activated (C-1)', async () => {
    billingRequests.startCheckout.mockResolvedValue(CHECKOUT_URL);
    render(<BillingActions />);

    await userEvent.click(screen.getByRole('button', { name: 'Upgrade' }));

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith(CHECKOUT_URL);
    });
  });

  it('sends the browser to the portal URL when Manage billing is activated (C-2)', async () => {
    billingRequests.openPortal.mockResolvedValue(PORTAL_URL);
    render(<BillingActions />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Manage billing' }),
    );

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith(PORTAL_URL);
    });
  });

  it('disables both buttons while checkout is pending and ignores a second activation (C-3)', async () => {
    billingRequests.startCheckout.mockImplementation(neverSettles);
    render(<BillingActions />);

    await userEvent.click(screen.getByRole('button', { name: 'Upgrade' }));

    const redirecting = await screen.findByRole('button', {
      name: 'Redirecting',
    });
    expect(redirecting).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Manage billing' }),
    ).toBeDisabled();

    await userEvent.click(redirecting);
    expect(billingRequests.startCheckout).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
  });

  it('disables both buttons while the portal request is pending (C-3)', async () => {
    billingRequests.openPortal.mockImplementation(neverSettles);
    render(<BillingActions />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Manage billing' }),
    );

    const redirecting = await screen.findByRole('button', {
      name: 'Redirecting',
    });
    expect(redirecting).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Upgrade' })).toBeDisabled();

    await userEvent.click(redirecting);
    expect(billingRequests.openPortal).toHaveBeenCalledTimes(1);
  });

  it('explains a missing billing account and re-enables the buttons (C-4)', async () => {
    billingRequests.openPortal.mockRejectedValue(
      new ApiError(400, 'No billing account found', 'BILLING_NO_ACCOUNT'),
    );
    render(<BillingActions />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Manage billing' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      NO_ACCOUNT_ERROR,
    );
    expect(screen.getByRole('button', { name: 'Upgrade' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Manage billing' }),
    ).toBeEnabled();
    expect(assign).not.toHaveBeenCalled();
  });

  it('shows the generic message when checkout fails (C-4)', async () => {
    billingRequests.startCheckout.mockRejectedValue(
      new ApiError(503, 'Billing is not configured', 'BILLING_NOT_CONFIGURED'),
    );
    render(<BillingActions />);

    await userEvent.click(screen.getByRole('button', { name: 'Upgrade' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR);
    expect(screen.getByRole('button', { name: 'Upgrade' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Manage billing' }),
    ).toBeEnabled();
  });

  it('shows the generic message when the portal fails for another reason (C-4)', async () => {
    billingRequests.openPortal.mockRejectedValue(new Error('Network down'));
    render(<BillingActions />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Manage billing' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR);
  });

  it('shows no alert before anything fails (C-4)', () => {
    render(<BillingActions />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('is operable from the keyboard (C-7)', async () => {
    billingRequests.startCheckout.mockImplementation(neverSettles);
    billingRequests.openPortal.mockResolvedValue(PORTAL_URL);
    const user = userEvent.setup();
    render(<BillingActions />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Upgrade' })).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole('button', { name: 'Manage billing' }),
    ).toHaveFocus();

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith(PORTAL_URL);
    });
    expect(billingRequests.startCheckout).not.toHaveBeenCalled();
  });

  it('adds no page heading, so the dashboard keeps one h1 (C-7)', () => {
    render(<BillingActions />);

    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(0);
  });
});
