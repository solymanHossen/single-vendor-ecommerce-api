import { z } from 'zod';
import { MAX_CART_ITEM_QUANTITY } from '../carts.constants';

export const AddCartItemSchema = z
  .object({
    productId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(MAX_CART_ITEM_QUANTITY).default(1),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type AddCartItemDto = z.infer<typeof AddCartItemSchema>;
