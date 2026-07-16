import { z } from 'zod';
import { PasswordSchema } from './password.schema';

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, 'token is required'),
    password: PasswordSchema,
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
