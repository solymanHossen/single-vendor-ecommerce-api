import { z } from 'zod';

export const ADMIN_PRODUCT_SORT_FIELDS = [
  'updatedAt',
  'createdAt',
  'name',
  'basePrice',
  'stockQuantity',
] as const;

export const AdminProductQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(150).optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    status: z.enum(['all', 'published', 'draft']).default('all'),
    // in = above the low-stock threshold, low = 1..threshold, out = 0.
    stock: z.enum(['all', 'in', 'low', 'out']).default('all'),
    sortBy: z.enum(ADMIN_PRODUCT_SORT_FIELDS).default('updatedAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type AdminProductQueryDto = z.infer<typeof AdminProductQuerySchema>;
export type AdminProductSortField = (typeof ADMIN_PRODUCT_SORT_FIELDS)[number];
