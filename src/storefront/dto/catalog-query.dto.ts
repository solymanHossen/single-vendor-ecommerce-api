import { z } from 'zod';
import { COLLECTION_KEYS } from '../storefront.constants';

export const CATALOG_SORTS = [
  'featured',
  'newest',
  'price-asc',
  'price-desc',
  'rating',
  'best-selling',
] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

export const CATALOG_MAX_PAGE_SIZE = 48;

/** See ProductQuerySchema: z.coerce.boolean() would parse "false" as true. */
const booleanQueryParam = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

/**
 * Shopper-facing catalog query. Unlike the admin ProductQuerySchema it
 * addresses categories by slug (and includes their sub-categories), filters
 * on the price the shopper actually pays, and only ever sees published
 * products — there is deliberately no isPublished parameter.
 */
export const CatalogQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(CATALOG_MAX_PAGE_SIZE).default(24),
    q: z.string().trim().min(1).max(150).optional(),
    category: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]+$/, 'category must be a slug')
      .max(120)
      .optional(),
    collection: z.enum(COLLECTION_KEYS).optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    inStock: booleanQueryParam,
    sort: z.enum(CATALOG_SORTS).default('featured'),
  })
  .strict()
  .refine(
    (data) =>
      data.minPrice === undefined || data.maxPrice === undefined || data.minPrice <= data.maxPrice,
    { message: 'minPrice must not exceed maxPrice', path: ['maxPrice'] },
  );

export type CatalogQueryDto = z.infer<typeof CatalogQuerySchema>;
