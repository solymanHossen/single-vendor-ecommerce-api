import { z } from 'zod';

export const UpdateAddressSchema = z
  .object({
    recipientName: z.string().trim().min(2, 'recipientName is required').max(100).optional(),
    phone: z
      .string()
      .trim()
      // Bangladeshi mobile: 01XXXXXXXXX, optionally with +88 / 88.
      .regex(
        /^(?:\+?88)?01[3-9]\d{8}$/,
        'Enter a valid Bangladeshi mobile number, e.g. 01712345678',
      )
      .optional(),
    addressLine1: z.string().trim().min(1, 'addressLine1 is required').max(255).optional(),
    addressLine2: z.string().trim().max(255).nullable().optional(),
    city: z.string().trim().min(1, 'city is required').max(100).optional(),
    state: z.string().trim().min(1, 'state is required').max(100).optional(),
    postalCode: z.string().trim().min(1, 'postalCode is required').max(20).optional(),
    country: z.string().trim().min(1, 'country is required').max(100).optional(),
    isDefault: z.boolean().optional(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateAddressDto = z.infer<typeof UpdateAddressSchema>;
