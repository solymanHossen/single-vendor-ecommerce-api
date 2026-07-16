import { z } from 'zod';
import { PasswordSchema } from './password.schema';

export const RegisterSchema = z
  .object({
    email: z.string().email(),
    name: z.string().max(100).optional(),
    password: PasswordSchema,
  })
  // Reject unrecognized fields (e.g. a client-supplied `role`) instead of the
  // Zod object default of silently stripping them — matches the whitelist +
  // forbidNonWhitelisted contract StrictValidationPipe applies to class-based DTOs.
  .strict();

export type RegisterDto = z.infer<typeof RegisterSchema>;
