import { z } from 'zod';

export const LoginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1, 'password is required'),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type LoginDto = z.infer<typeof LoginSchema>;
