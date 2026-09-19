import type { Meta, StoryObj } from '@storybook/react-vite';

import { BillingStatusBanner } from './BillingStatusBanner';

const meta: Meta<typeof BillingStatusBanner> = {
  component: BillingStatusBanner,
  title: 'Billing/BillingStatusBanner',
};

export default meta;

type Story = StoryObj<typeof BillingStatusBanner>;

export const CheckoutComplete: Story = {
  args: { checkoutStatus: 'success' },
};

export const CheckoutCanceled: Story = {
  args: { checkoutStatus: 'canceled' },
};
