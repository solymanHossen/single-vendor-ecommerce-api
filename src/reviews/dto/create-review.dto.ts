import { z } from 'zod';
import { MAX_REVIEW_IMAGES } from '../reviews.constants';

/** Photos uploaded through /storage/upload with folder=reviews. */
export const REVIEW_IMAGES = z
  .array(
    z
      .string()
      .trim()
      .url()
      .max(1000)
      .regex(/\/reviews\/[^/]+$/, 'photos must be uploaded to the "reviews" folder'),
  )
  .max(MAX_REVIEW_IMAGES, `at most ${MAX_REVIEW_IMAGES} photos`);

export const REVIEW_RATING = z
  .number()
  .int()
  .min(1, 'rating must be at least 1')
  .max(5, 'rating must be at most 5');

export const CreateReviewSchema = z
  .object({
    productId: z.number().int().positive(),
    rating: REVIEW_RATING,
    title: z.string().trim().max(120).optional(),
    comment: z.string().trim().max(2000).optional(),
    images: REVIEW_IMAGES.optional(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type CreateReviewDto = z.infer<typeof CreateReviewSchema>;

export const UpdateReviewSchema = z
  .object({
    rating: REVIEW_RATING.optional(),
    // null / "" clears it.
    title: z.string().trim().max(120).nullable().optional(),
    comment: z.string().trim().max(2000).nullable().optional(),
    images: REVIEW_IMAGES.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateReviewDto = z.infer<typeof UpdateReviewSchema>;
