import { z } from 'zod';

const PRODUCT_SORT_FIELDS = ['createdAt', 'name', 'basePrice', 'stockQuantity'] as const;

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

export const ProductQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(PRODUCT_SORT_FIELDS).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    categoryId: z.coerce.number().int().positive().optional(),
    search: z.string().trim().min(1).max(150).optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    isPublished: booleanQueryParam,
    inStock: booleanQueryParam,
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict()
  .refine(
    (data) =>
      data.minPrice === undefined || data.maxPrice === undefined || data.minPrice <= data.maxPrice,
    { message: 'minPrice must not exceed maxPrice', path: ['maxPrice'] },
  );

export type ProductQueryDto = z.infer<typeof ProductQuerySchema>;
export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];
