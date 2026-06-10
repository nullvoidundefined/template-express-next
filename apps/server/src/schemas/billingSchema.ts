import { z } from 'zod';

export const createCheckoutSchema = z.object({
  priceId: z.string().regex(/^price_[A-Za-z0-9]+$/, 'Invalid price ID'),
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
