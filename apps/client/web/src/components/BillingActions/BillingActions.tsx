'use client';

/**
 * The dashboard's billing buttons: Upgrade starts a Stripe Checkout and Manage
 * billing opens the Stripe portal, each redirecting the browser to the URL the
 * server returns. Both are disabled while either request is pending, and a
 * failure is announced in an alert.
 */
import { useState } from 'react';

import { Button } from '@/components/Button/Button';
import { ApiError } from '@/services/apiService';
import { useBilling } from '@/state/useBillingHook';

import styles from './BillingActions.module.scss';

const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';
const NO_ACCOUNT_ERROR_MESSAGE =
  "You don't have a billing account yet. Upgrade to create one.";

function describeBillingError(err: unknown): string {
  return err instanceof ApiError && err.code === 'BILLING_NO_ACCOUNT'
    ? NO_ACCOUNT_ERROR_MESSAGE
    : GENERIC_ERROR_MESSAGE;
}

function BillingActions() {
  const { isCheckoutPending, isPortalPending, openPortal, startCheckout } =
    useBilling();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isPending = isCheckoutPending || isPortalPending;

  async function redirectToStripe(request: () => Promise<string>) {
    if (isPending) {
      return;
    }
    setErrorMessage(null);
    try {
      window.location.assign(await request());
    } catch (err) {
      setErrorMessage(describeBillingError(err));
    }
  }

  return (
    <section
      aria-label='Billing'
      className={styles.billingActions}
      data-test-id='billing-actions'
    >
      <div className={styles.buttons}>
        <Button
          disabled={isPending}
          onClick={() => void redirectToStripe(startCheckout)}
          type='button'
        >
          {isCheckoutPending ? 'Redirecting' : 'Upgrade'}
        </Button>
        <Button
          disabled={isPending}
          onClick={() => void redirectToStripe(openPortal)}
          type='button'
          variant='secondary'
        >
          {isPortalPending ? 'Redirecting' : 'Manage billing'}
        </Button>
      </div>
      {errorMessage && (
        <p className={styles.error} role='alert'>
          {errorMessage}
        </p>
      )}
    </section>
  );
}

BillingActions.displayName = 'BillingActions';

export { BillingActions };
