import { z } from 'zod';

/** Optional text: trimmed, and an empty string clears the value (→ null). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

const optionalUrl = (max = 1000) =>
  z
    .union([
      z.literal('').transform(() => null),
      z
        .string()
        .trim()
        .max(max)
        .url('Enter a full link starting with https://')
        .refine(
          (value) => /^https?:\/\//i.test(value),
          'Links must start with http:// or https://',
        ),
    ])
    .nullable()
    .optional();

/** Loose on purpose: support lines can be landlines, hotlines or +880 mobiles. */
const optionalPhone = z
  .union([
    z.literal('').transform(() => null),
    z
      .string()
      .trim()
      .regex(/^\+?[\d\s-]{5,20}$/, 'Enter a phone number using digits, spaces or dashes'),
  ])
  .nullable()
  .optional();

const money = (max: number) => z.number().int('Use whole taka').min(0).max(max).optional();

export const UpdateSettingsSchema = z
  .object({
    // Customer accounts
    allowRegistration: z.boolean().optional(),
    enableGoogleLogin: z.boolean().optional(),
    // Branding
    storeName: z.string().trim().min(1, 'Store name is required').max(60).optional(),
    tagline: z.string().trim().max(120).optional(),
    logoUrl: optionalUrl(),
    faviconUrl: optionalUrl(),
    // Contact
    supportEmail: z
      .union([z.literal('').transform(() => null), z.string().trim().email('Enter a valid email')])
      .nullable()
      .optional(),
    supportPhone: optionalPhone,
    whatsappNumber: optionalPhone,
    storeAddress: optionalText(300),
    businessHours: optionalText(120),
    // Social
    facebookUrl: optionalUrl(300),
    instagramUrl: optionalUrl(300),
    youtubeUrl: optionalUrl(300),
    tiktokUrl: optionalUrl(300),
    // Shipping
    shippingFeeInsideDhaka: money(100_000),
    shippingFeeOutsideDhaka: money(100_000),
    freeShippingThreshold: money(10_000_000),
    // Announcement bar
    announcementEnabled: z.boolean().optional(),
    announcementMessage: z.string().trim().max(200).optional(),
    announcementPromotion: z.boolean().optional(),
    // SEO
    metaTitle: optionalText(70),
    metaDescription: optionalText(160),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one setting field must be provided',
  });

export type UpdateSettingsDto = z.infer<typeof UpdateSettingsSchema>;
