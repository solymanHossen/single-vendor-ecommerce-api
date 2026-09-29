import { z } from 'zod';
import { REVIEW_SORTS, REVIEW_STATUSES } from '../reviews.constants';

/**
 * Query params always arrive as strings. `z.enum(['true', 'false'])` (rather
 * than `z.coerce.boolean()`, which treats ANY non-empty string — including
 * the literal string "false" — as `true`) is the only safe way to parse a
 * boolean out of a query string.
 */
const booleanQueryParam = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

/** Published reviews on a product page. */
export const ReviewQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(20).default(5),
    sort: z.enum(REVIEW_SORTS).default('recent'),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    withPhotos: booleanQueryParam,
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type ReviewQueryDto = z.infer<typeof ReviewQuerySchema>;

/** The moderation queue. */
export const AdminReviewQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum([...REVIEW_STATUSES, 'ALL']).default('ALL'),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    /** Product name, customer name or email. */
    search: z.string().trim().min(1).max(150).optional(),
  })
  .strict();

export type AdminReviewQueryDto = z.infer<typeof AdminReviewQuerySchema>;

export const ModerateReviewSchema = z.object({ status: z.enum(['PUBLISHED', 'HIDDEN']) }).strict();
export type ModerateReviewDto = z.infer<typeof ModerateReviewSchema>;
