import { z } from 'zod';

export const ForgotPasswordSchema = z
  .object({
    email: z.string().email(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;
