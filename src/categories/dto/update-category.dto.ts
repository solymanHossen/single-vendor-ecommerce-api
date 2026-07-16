import { z } from 'zod';
import { SlugSchema } from '../../common/validators/slug.schema';

export const UpdateCategorySchema = z
  .object({
    name: z.string().trim().min(2, 'name must be at least 2 characters').max(150).optional(),
    slug: SlugSchema.optional(),
    // `null` un-parents the category (promotes it to top-level); `undefined`/omitted leaves it untouched.
    parentId: z.number().int().positive().nullable().optional(),
    iconUrl: z.string().trim().url().max(500).nullable().optional(),
    metaTitle: z.string().trim().max(160).nullable().optional(),
    metaDesc: z.string().trim().max(300).nullable().optional(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateCategoryDto = z.infer<typeof UpdateCategorySchema>;
