import type { Meta, StoryObj } from '@storybook/react-vite';

import { QueryProvider } from '@/providers/QueryProvider';

import { BillingActions } from './BillingActions';

// BillingActions runs TanStack Query mutations, so the story needs the same
// QueryProvider the app's root layout supplies.
const meta: Meta<typeof BillingActions> = {
  component: BillingActions,
  decorators: [
    (Story) => (
      <QueryProvider>
        <Story />
      </QueryProvider>
    ),
  ],
  title: 'Billing/BillingActions',
};

export default meta;

type Story = StoryObj<typeof BillingActions>;

export const Default: Story = {};
