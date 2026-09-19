import { BillingActions } from '@/components/BillingActions/BillingActions';
import { BillingStatusBanner } from '@/components/BillingStatusBanner/BillingStatusBanner';

type DashboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Stripe sends customers back here with ?checkout=success|canceled (Checkout)
// or ?portal=returned (the billing portal, which shows no banner).
async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { checkout } = await searchParams;
  const checkoutStatus = typeof checkout === 'string' ? checkout : undefined;
  return (
    <main data-test-id='dashboard-page'>
      <h1>Dashboard</h1>
      <BillingStatusBanner checkoutStatus={checkoutStatus} />
      <BillingActions />
    </main>
  );
}

DashboardPage.displayName = 'DashboardPage';

export default DashboardPage;
