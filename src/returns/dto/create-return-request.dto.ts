import { z } from 'zod';

export const CreateReturnRequestSchema = z
  .object({
    orderId: z.number().int().positive(),
    reason: z.string().trim().min(10, 'reason must be at least 10 characters').max(2000),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type CreateReturnRequestDto = z.infer<typeof CreateReturnRequestSchema>;
