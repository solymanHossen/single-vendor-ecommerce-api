import { z } from 'zod';

const MAX_DECIMAL_AMOUNT = 999_999_999.99;

export const CreateProductVariantSchema = z
  .object({
    sku: z.string().trim().min(1, 'sku is required').max(100),
    price: z.number().positive().max(MAX_DECIMAL_AMOUNT),
    stockQuantity: z.number().int().min(0).default(0),
    imageUrl: z.string().trim().url().max(1000).optional(),
    attributeOptionIds: z
      .array(z.number().int().positive())
      .min(1, 'at least one attribute option is required')
      .max(10),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict()
  .refine((data) => new Set(data.attributeOptionIds).size === data.attributeOptionIds.length, {
    message: 'attributeOptionIds must not contain duplicates',
    path: ['attributeOptionIds'],
  });

export type CreateProductVariantDto = z.infer<typeof CreateProductVariantSchema>;
