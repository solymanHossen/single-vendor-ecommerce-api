import { z } from 'zod';

export const UpdateProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'name must be at least 2 characters').max(150).optional(),
    phone: z
      .string()
      .trim()
      .min(7, 'phone must be at least 7 characters')
      .max(20)
      .regex(/^[+0-9()\-\s]+$/, 'phone must contain only digits, spaces, and + ( ) - characters')
      .nullable()
      .optional(),
    avatarUrl: z.string().trim().url().max(1000).nullable().optional(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;
