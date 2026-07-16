import { z } from 'zod';
import { SlugSchema } from '../../common/validators/slug.schema';

const MAX_DECIMAL_AMOUNT = 999_999_999.99;

export const ProductImageInputSchema = z
  .object({
    url: z.string().trim().url().max(1000),
    isThumbnail: z.boolean().optional().default(false),
  })
  .strict();

export const CreateProductSchema = z
  .object({
    categoryId: z.number().int().positive(),
    name: z.string().trim().min(2, 'name must be at least 2 characters').max(200),
    slug: SlugSchema,
    description: z.string().trim().min(1, 'description is required'),
    basePrice: z.number().positive().max(MAX_DECIMAL_AMOUNT),
    discountPrice: z.number().positive().max(MAX_DECIMAL_AMOUNT).optional(),
    sku: z.string().trim().min(1, 'sku is required').max(100),
    stockQuantity: z.number().int().min(0).default(0),
    isPublished: z.boolean().default(false),
    metaTitle: z.string().trim().max(160).optional(),
    metaDesc: z.string().trim().max(300).optional(),
    images: z.array(ProductImageInputSchema).max(20).optional(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict()
  .refine((data) => data.discountPrice === undefined || data.discountPrice < data.basePrice, {
    message: 'discountPrice must be less than basePrice',
    path: ['discountPrice'],
  });

export type CreateProductDto = z.infer<typeof CreateProductSchema>;
export type ProductImageInputDto = z.infer<typeof ProductImageInputSchema>;
