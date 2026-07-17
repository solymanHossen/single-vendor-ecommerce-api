import { z } from 'zod';

export const CreateAddressSchema = z
  .object({
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
