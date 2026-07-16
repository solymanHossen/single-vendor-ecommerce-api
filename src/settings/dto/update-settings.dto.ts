import { z } from 'zod';

export const UpdateSettingsSchema = z
  .object({
    allowRegistration: z.boolean().optional(),
    enableGoogleLogin: z.boolean().optional(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one setting field must be provided',
  });

export type UpdateSettingsDto = z.infer<typeof UpdateSettingsSchema>;
