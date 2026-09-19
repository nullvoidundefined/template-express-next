import type { Meta, StoryObj } from '@storybook/react-vite';

import { BillingActions } from './BillingActions';

const meta: Meta<typeof BillingActions> = {
  component: BillingActions,
  title: 'Billing/BillingActions',
};

export default meta;

type Story = StoryObj<typeof BillingActions>;

export const Default: Story = {};
