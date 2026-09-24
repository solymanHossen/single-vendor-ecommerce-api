import { z } from 'zod';
import { CHECKOUT_PAYMENT_METHODS } from '../orders.constants';

export const PlaceOrderSchema = z
  .object({
    addressId: z.number().int().positive(),
    paymentMethod: z.enum(CHECKOUT_PAYMENT_METHODS).default('COD'),
    couponCode: z.string().trim().min(1).max(50).optional(),
    note: z.string().trim().max(500).optional(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type PlaceOrderDto = z.infer<typeof PlaceOrderSchema>;
