import { z } from 'zod';

export const UpdateAttributeSchema = z
  .object({
    name: z.string().trim().min(2, 'name must be at least 2 characters').max(100).optional(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateAttributeDto = z.infer<typeof UpdateAttributeSchema>;
