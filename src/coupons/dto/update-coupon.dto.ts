import { z } from 'zod';
import { DISCOUNT_TYPE_VALUES } from '../coupons.constants';

const MAX_DECIMAL_AMOUNT = 999_999_999.99;

export const UpdateCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, 'code must be at least 3 characters')
      .max(50)
      .regex(/^[A-Za-z0-9_-]+$/, 'code must contain only letters, digits, hyphens, and underscores')
      .optional(),
    discountType: z.enum(DISCOUNT_TYPE_VALUES).optional(),
    discountValue: z.number().positive().max(MAX_DECIMAL_AMOUNT).optional(),
    // `null` clears an existing cap/minimum; `undefined`/omitted leaves it untouched.
    minOrderAmount: z.number().nonnegative().max(MAX_DECIMAL_AMOUNT).nullable().optional(),
    maxDiscountAmount: z.number().positive().max(MAX_DECIMAL_AMOUNT).nullable().optional(),
    usageLimit: z.number().int().positive().nullable().optional(),
    // Kept as an ISO string (not z.coerce.date()) — a Date-typed schema can't
    // be represented in JSON Schema (z.toJSONSchema() throws for it), which
    // would break Swagger generation. Prisma accepts ISO strings for
    // DateTime fields directly, so no conversion is needed downstream.
    validFrom: z.iso.datetime().optional(),
    validUntil: z.iso.datetime().optional(),
    isActive: z.boolean().optional(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })
  .refine(
    (data) =>
      data.validFrom === undefined ||
      data.validUntil === undefined ||
      new Date(data.validUntil) > new Date(data.validFrom),
    { message: 'validUntil must be after validFrom', path: ['validUntil'] },
  )
  .refine(
    (data) =>
      data.discountType !== 'PERCENTAGE' ||
      data.discountValue === undefined ||
      data.discountValue <= 100,
    {
      message: 'discountValue must be at most 100 for a PERCENTAGE coupon',
      path: ['discountValue'],
    },
  );

export type UpdateCouponDto = z.infer<typeof UpdateCouponSchema>;
