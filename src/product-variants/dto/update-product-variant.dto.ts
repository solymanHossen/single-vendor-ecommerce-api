import { z } from 'zod';

const MAX_DECIMAL_AMOUNT = 999_999_999.99;

export const UpdateProductVariantSchema = z
  .object({
    sku: z.string().trim().min(1, 'sku is required').max(100).optional(),
    price: z.number().positive().max(MAX_DECIMAL_AMOUNT).optional(),
    stockQuantity: z.number().int().min(0).optional(),
    imageUrl: z.string().trim().url().max(1000).nullable().optional(),
    // When provided, this REPLACES the variant's entire attribute-option set.
    attributeOptionIds: z
      .array(z.number().int().positive())
      .min(1, 'at least one attribute option is required')
      .max(10)
      .optional(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })
  .refine(
    (data) =>
      data.attributeOptionIds === undefined ||
      new Set(data.attributeOptionIds).size === data.attributeOptionIds.length,
    { message: 'attributeOptionIds must not contain duplicates', path: ['attributeOptionIds'] },
  );

export type UpdateProductVariantDto = z.infer<typeof UpdateProductVariantSchema>;
