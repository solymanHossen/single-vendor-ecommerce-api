import { z } from 'zod';
import { SlugSchema } from '../../common/validators/slug.schema';
import { ProductImageInputSchema } from './create-product.dto';

const MAX_DECIMAL_AMOUNT = 999_999_999.99;

export const UpdateProductSchema = z
  .object({
    categoryId: z.number().int().positive().optional(),
    name: z.string().trim().min(2, 'name must be at least 2 characters').max(200).optional(),
    slug: SlugSchema.optional(),
    description: z.string().trim().min(1, 'description is required').optional(),
    basePrice: z.number().positive().max(MAX_DECIMAL_AMOUNT).optional(),
    // `null` clears an existing discount; `undefined`/omitted leaves it untouched.
    discountPrice: z.number().positive().max(MAX_DECIMAL_AMOUNT).nullable().optional(),
    sku: z.string().trim().min(1, 'sku is required').max(100).optional(),
    stockQuantity: z.number().int().min(0).optional(),
    isPublished: z.boolean().optional(),
    metaTitle: z.string().trim().max(160).nullable().optional(),
    metaDesc: z.string().trim().max(300).nullable().optional(),
    // When provided, this REPLACES the product's entire image set.
    images: z.array(ProductImageInputSchema).max(20).optional(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })
  .refine(
    (data) =>
      data.discountPrice === undefined ||
      data.discountPrice === null ||
      data.basePrice === undefined ||
      data.discountPrice < data.basePrice,
    { message: 'discountPrice must be less than basePrice', path: ['discountPrice'] },
  );

export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;
