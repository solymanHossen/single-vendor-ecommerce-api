import { z } from 'zod';

export const CreateAttributeOptionSchema = z
  .object({
    value: z.string().trim().min(1, 'value is required').max(100),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type CreateAttributeOptionDto = z.infer<typeof CreateAttributeOptionSchema>;
