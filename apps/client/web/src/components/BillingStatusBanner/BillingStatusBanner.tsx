/**
 * Announces the outcome Stripe Checkout reports when it sends the customer
 * back to the dashboard (?checkout=success or ?checkout=canceled); renders
 * nothing for any other value.
 */
import styles from './BillingStatusBanner.module.scss';

const CHECKOUT_STATUS_MESSAGES: Record<string, string> = {
  canceled: 'Checkout canceled. You have not been charged.',
  success: 'Thanks, your checkout is complete.',
};

type BillingStatusBannerProps = {
  checkoutStatus: string | undefined;
};

function BillingStatusBanner({ checkoutStatus }: BillingStatusBannerProps) {
  const message =
    checkoutStatus === undefined
      ? undefined
      : CHECKOUT_STATUS_MESSAGES[checkoutStatus];
  if (message === undefined) {
    return null;
  }
  return (
    <p
      className={styles.banner}
      data-test-id='billing-status-banner'
      role='status'
    >
      {message}
    </p>
  );
}

BillingStatusBanner.displayName = 'BillingStatusBanner';

export { BillingStatusBanner };
export type { BillingStatusBannerProps };
