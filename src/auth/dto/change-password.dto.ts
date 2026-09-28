import { z } from 'zod';
import { PasswordSchema } from './password.schema';

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'currentPassword is required').max(72),
    newPassword: PasswordSchema,
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict()
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'Choose a new password that differs from the current one',
    path: ['newPassword'],
  });

export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
