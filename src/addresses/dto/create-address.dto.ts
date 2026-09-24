import { z } from 'zod';

export const CreateAddressSchema = z
  .object({
    recipientName: z.string().trim().min(2, 'recipientName is required').max(100),
    phone: z
      .string()
      .trim()
      // Bangladeshi mobile: 01XXXXXXXXX, optionally with +88 / 88.
      .regex(
        /^(?:\+?88)?01[3-9]\d{8}$/,
        'Enter a valid Bangladeshi mobile number, e.g. 01712345678',
      ),
    addressLine1: z.string().trim().min(1, 'addressLine1 is required').max(255),
    addressLine2: z.string().trim().max(255).optional(),
    city: z.string().trim().min(1, 'city is required').max(100),
    state: z.string().trim().min(1, 'state is required').max(100),
    postalCode: z.string().trim().min(1, 'postalCode is required').max(20),
    country: z.string().trim().min(1, 'country is required').max(100),
    isDefault: z.boolean().default(false),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type CreateAddressDto = z.infer<typeof CreateAddressSchema>;
