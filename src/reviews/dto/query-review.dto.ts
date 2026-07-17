import { z } from 'zod';

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

export const ReviewQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    productId: z.coerce.number().int().positive().optional(),
    userId: z.coerce.number().int().positive().optional(),
    isApproved: booleanQueryParam,
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type ReviewQueryDto = z.infer<typeof ReviewQuerySchema>;
