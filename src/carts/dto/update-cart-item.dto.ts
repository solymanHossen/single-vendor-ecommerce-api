import { z } from 'zod';
import { MAX_CART_ITEM_QUANTITY } from '../carts.constants';

export const UpdateCartItemSchema = z
  .object({
    quantity: z.number().int().min(1, 'quantity must be at least 1').max(MAX_CART_ITEM_QUANTITY),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type UpdateCartItemDto = z.infer<typeof UpdateCartItemSchema>;
