import { z } from 'zod';

export const QuoteOrderSchema = z
  .object({
    // Without an address the shipping fee can't be known yet (it depends on the city).
    addressId: z.number().int().positive().optional(),
    couponCode: z.string().trim().min(1).max(50).optional(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type QuoteOrderDto = z.infer<typeof QuoteOrderSchema>;
