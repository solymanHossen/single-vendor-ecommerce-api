import { z } from 'zod';
import { DISCOUNT_TYPE_VALUES, MAX_DECIMAL_AMOUNT } from '../coupons.constants';

export const COUPON_CODE = z
  .string()
  .trim()
  .min(3, 'code must be at least 3 characters')
  .max(50)
  .regex(/^[A-Za-z0-9_-]+$/, 'code must contain only letters, digits, hyphens, and underscores');

/** Rules shared by create and (merged) update — see CouponsService.assertCoherent. */
export const COUPON_FIELDS = {
  code: COUPON_CODE,
  discountType: z.enum(DISCOUNT_TYPE_VALUES),
  // 0 is only meaningful for FREE_SHIPPING (which ignores it).
  discountValue: z.number().nonnegative().max(MAX_DECIMAL_AMOUNT),
  minOrderAmount: z.number().nonnegative().max(MAX_DECIMAL_AMOUNT),
  maxDiscountAmount: z.number().positive().max(MAX_DECIMAL_AMOUNT),
  usageLimit: z.number().int().positive().max(10_000_000),
  perCustomerLimit: z.number().int().positive().max(1_000),
  description: z.string().trim().max(200),
  // Kept as an ISO string (not z.coerce.date()) — a Date-typed schema can't
  // be represented in JSON Schema (z.toJSONSchema() throws for it), which
  // would break Swagger generation. Prisma accepts ISO strings for
  // DateTime fields directly, so no conversion is needed downstream.
  validFrom: z.iso.datetime(),
  validUntil: z.iso.datetime(),
  isActive: z.boolean(),
};

export const CreateCouponSchema = z
  .object({
    code: COUPON_FIELDS.code,
    discountType: COUPON_FIELDS.discountType,
    discountValue: COUPON_FIELDS.discountValue.default(0),
    minOrderAmount: COUPON_FIELDS.minOrderAmount.optional(),
    maxDiscountAmount: COUPON_FIELDS.maxDiscountAmount.optional(),
    usageLimit: COUPON_FIELDS.usageLimit.optional(),
    perCustomerLimit: COUPON_FIELDS.perCustomerLimit.optional(),
    description: COUPON_FIELDS.description.optional(),
    validFrom: COUPON_FIELDS.validFrom,
    validUntil: COUPON_FIELDS.validUntil,
    isActive: COUPON_FIELDS.isActive.default(true),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type CreateCouponDto = z.infer<typeof CreateCouponSchema>;
