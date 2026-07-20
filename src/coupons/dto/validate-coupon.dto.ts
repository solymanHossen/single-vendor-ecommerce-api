import { z } from 'zod';

export const ValidateCouponSchema = z
  .object({
    code: z.string().trim().min(1, 'code is required').max(50),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type ValidateCouponDto = z.infer<typeof ValidateCouponSchema>;
