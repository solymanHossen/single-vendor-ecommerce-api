import { z } from 'zod';

export const BulkProductStatusSchema = z
  .object({
    ids: z
      .array(z.number().int().positive())
      .min(1, 'select at least one product')
      .max(100, 'at most 100 products per request'),
    isPublished: z.boolean(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict()
  .refine((data) => new Set(data.ids).size === data.ids.length, {
    message: 'ids must not contain duplicates',
    path: ['ids'],
  });

export type BulkProductStatusDto = z.infer<typeof BulkProductStatusSchema>;
