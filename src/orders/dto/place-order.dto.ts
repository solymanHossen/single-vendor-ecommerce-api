import { z } from 'zod';

export const PlaceOrderSchema = z
  .object({
    addressId: z.number().int().positive(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type PlaceOrderDto = z.infer<typeof PlaceOrderSchema>;
