import { z } from 'zod';

export const UpdateAttributeOptionSchema = z
  .object({
    value: z.string().trim().min(1, 'value is required').max(100).optional(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateAttributeOptionDto = z.infer<typeof UpdateAttributeOptionSchema>;
