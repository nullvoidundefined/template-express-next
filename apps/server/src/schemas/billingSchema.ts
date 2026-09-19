import { z } from 'zod';

// Checkout takes no input: the price comes from the server's STRIPE_PRICE_ID,
// so a client can never choose which price it subscribes to. Any field in the
// body, priceId included, fails validation.
export const createCheckoutSchema = z.object({}).strict();

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
