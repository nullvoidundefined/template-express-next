import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BillingStatusBanner } from '@/components/BillingStatusBanner/BillingStatusBanner';

describe('BillingStatusBanner', () => {
  it('announces a completed checkout (C-5)', () => {
    render(<BillingStatusBanner checkoutStatus='success' />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Thanks, your checkout is complete.',
    );
  });

  it('announces a canceled checkout (C-5)', () => {
    render(<BillingStatusBanner checkoutStatus='canceled' />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Checkout canceled. You have not been charged.',
    );
  });

  it.each([undefined, '', 'returned', 'pending', 'SUCCESS'])(
    'renders nothing for checkout status %j (C-5)',
    (checkoutStatus) => {
      const { container } = render(
        <BillingStatusBanner checkoutStatus={checkoutStatus} />,
      );

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(container).toBeEmptyDOMElement();
    },
  );

  it('adds no page heading, so the dashboard keeps one h1 (C-7)', () => {
    render(<BillingStatusBanner checkoutStatus='success' />);

    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(0);
  });
});
