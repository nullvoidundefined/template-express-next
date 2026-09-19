'use client';

/**
 * The dashboard's billing buttons: Upgrade starts a Stripe Checkout and Manage
 * billing opens the Stripe portal, each redirecting the browser to the URL the
 * server returns. Both are disabled while either request is pending and while
 * the browser is leaving for Stripe; a failure is announced in an alert that
 * receives focus.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

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

type BillingRequestKind = 'checkout' | 'portal';

function BillingActions() {
  const { isCheckoutPending, isPortalPending, openPortal, startCheckout } =
    useBilling();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [redirectingTo, setRedirectingTo] = useState<BillingRequestKind | null>(
    null,
  );
  const alertRef = useRef<HTMLParagraphElement>(null);
  // Set synchronously on activation: TanStack reports pending only on a later
  // macrotask, so a render-time flag alone lets a second click through.
  const isRequestInFlightRef = useRef(false);

  const isCheckoutBusy = isCheckoutPending || redirectingTo === 'checkout';
  const isPortalBusy = isPortalPending || redirectingTo === 'portal';
  const isBusy = isCheckoutBusy || isPortalBusy;

  useEffect(() => {
    if (errorMessage !== null) {
      alertRef.current?.focus();
    }
  }, [errorMessage]);

  const handleRedirectToStripe = useCallback(
    async function redirectToStripe(
      kind: BillingRequestKind,
      request: () => Promise<string>,
    ) {
      if (isRequestInFlightRef.current || redirectingTo !== null) {
        return;
      }
      isRequestInFlightRef.current = true;
      setErrorMessage(null);
      try {
        const url = await request();
        // Hold the buttons disabled until the page unloads for Stripe.
        setRedirectingTo(kind);
        window.location.assign(url);
      } catch (err) {
        isRequestInFlightRef.current = false;
        setErrorMessage(describeBillingError(err));
      }
    },
    [redirectingTo],
  );

  return (
    <section
      aria-label='Billing'
      className={styles.billingActions}
      data-test-id='billing-actions'
    >
      <div className={styles.buttons}>
        <Button
          disabled={isBusy}
          onClick={() => void handleRedirectToStripe('checkout', startCheckout)}
          type='button'
        >
          {isCheckoutBusy ? 'Redirecting' : 'Upgrade'}
        </Button>
        <Button
          disabled={isBusy}
          onClick={() => void handleRedirectToStripe('portal', openPortal)}
          type='button'
          variant='secondary'
        >
          {isPortalBusy ? 'Redirecting' : 'Manage billing'}
        </Button>
      </div>
      {errorMessage && (
        <p className={styles.error} ref={alertRef} role='alert' tabIndex={-1}>
          {errorMessage}
        </p>
      )}
    </section>
  );
}

BillingActions.displayName = 'BillingActions';

export { BillingActions };
