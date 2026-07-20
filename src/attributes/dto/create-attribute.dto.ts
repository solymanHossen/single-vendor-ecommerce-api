import { z } from 'zod';

export const CreateAttributeSchema = z
  .object({
    name: z.string().trim().min(2, 'name must be at least 2 characters').max(100),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type CreateAttributeDto = z.infer<typeof CreateAttributeSchema>;
