import { z } from 'zod';

export const CreateHeroBannerSchema = z
  .object({
    placement: z.enum(['MAIN', 'SIDE']),
    title: z.string().trim().min(2, 'title must be at least 2 characters').max(200),
    href: z.string().trim().min(1, 'href is required').max(500),
    // Set together from a prior POST /storage/upload call — imageUrl is the
    // permanent streamable link, imageKey is the storage object key kept
    // purely so a later delete/replace can clean up the old file.
    imageUrl: z.string().trim().url().max(1000),
    imageKey: z.string().trim().min(1, 'imageKey is required').max(500),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type CreateHeroBannerDto = z.infer<typeof CreateHeroBannerSchema>;
