import { z } from 'zod';
import { DISCOUNT_TYPE_VALUES } from '../coupons.constants';

const MAX_DECIMAL_AMOUNT = 999_999_999.99;

export const CreateCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, 'code must be at least 3 characters')
      .max(50)
      .regex(
        /^[A-Za-z0-9_-]+$/,
        'code must contain only letters, digits, hyphens, and underscores',
      ),
    discountType: z.enum(DISCOUNT_TYPE_VALUES),
    discountValue: z.number().positive().max(MAX_DECIMAL_AMOUNT),
    minOrderAmount: z.number().nonnegative().max(MAX_DECIMAL_AMOUNT).optional(),
    maxDiscountAmount: z.number().positive().max(MAX_DECIMAL_AMOUNT).optional(),
    usageLimit: z.number().int().positive().optional(),
    // Kept as an ISO string (not z.coerce.date()) — a Date-typed schema can't
    // be represented in JSON Schema (z.toJSONSchema() throws for it), which
    // would break Swagger generation. Prisma accepts ISO strings for
    // DateTime fields directly, so no conversion is needed downstream.
    validFrom: z.iso.datetime(),
    validUntil: z.iso.datetime(),
    isActive: z.boolean().default(true),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict()
  .refine((data) => new Date(data.validUntil) > new Date(data.validFrom), {
    message: 'validUntil must be after validFrom',
    path: ['validUntil'],
  })
  .refine((data) => data.discountType !== 'PERCENTAGE' || data.discountValue <= 100, {
    message: 'discountValue must be at most 100 for a PERCENTAGE coupon',
    path: ['discountValue'],
  });

export type CreateCouponDto = z.infer<typeof CreateCouponSchema>;
