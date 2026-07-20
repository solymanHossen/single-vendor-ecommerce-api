import { z } from 'zod';

export const CreateWishlistItemSchema = z
  .object({
    productId: z.number().int().positive(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type CreateWishlistItemDto = z.infer<typeof CreateWishlistItemSchema>;
