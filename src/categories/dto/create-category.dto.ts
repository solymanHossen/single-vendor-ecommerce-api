import { z } from 'zod';
import { SlugSchema } from '../../common/validators/slug.schema';

export const CreateCategorySchema = z
  .object({
    name: z.string().trim().min(2, 'name must be at least 2 characters').max(150),
    slug: SlugSchema,
    parentId: z.number().int().positive().optional(),
    iconUrl: z.string().trim().url().max(500).optional(),
    metaTitle: z.string().trim().max(160).optional(),
    metaDesc: z.string().trim().max(300).optional(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type CreateCategoryDto = z.infer<typeof CreateCategorySchema>;
