import { z } from 'zod';

export const UpdateHeroBannerSchema = z
  .object({
    placement: z.enum(['MAIN', 'SIDE']).optional(),
    title: z.string().trim().min(2, 'title must be at least 2 characters').max(200).optional(),
    href: z.string().trim().min(1, 'href is required').max(500).optional(),
    imageUrl: z.string().trim().url().max(1000).optional(),
    imageKey: z.string().trim().min(1, 'imageKey is required').max(500).optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateHeroBannerDto = z.infer<typeof UpdateHeroBannerSchema>;
