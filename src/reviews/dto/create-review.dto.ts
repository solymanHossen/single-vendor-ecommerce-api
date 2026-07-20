import { z } from 'zod';

export const CreateReviewSchema = z
  .object({
    productId: z.number().int().positive(),
    rating: z.number().int().min(1, 'rating must be at least 1').max(5, 'rating must be at most 5'),
    comment: z.string().trim().max(2000).optional(),
    images: z.array(z.string().trim().url().max(1000)).max(5).optional(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type CreateReviewDto = z.infer<typeof CreateReviewSchema>;
