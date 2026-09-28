import { z } from 'zod';
import { COUPON_FIELDS } from './create-coupon.dto';

// Cross-field rules (dates, percentage ≤ 100, …) are checked by the service
// against the MERGED coupon, so a partial update can't slip past them.
export const UpdateCouponSchema = z
  .object({
    code: COUPON_FIELDS.code.optional(),
    discountType: COUPON_FIELDS.discountType.optional(),
    discountValue: COUPON_FIELDS.discountValue.optional(),
    // `null` clears an existing cap/minimum/limit; omitted leaves it untouched.
    minOrderAmount: COUPON_FIELDS.minOrderAmount.nullable().optional(),
    maxDiscountAmount: COUPON_FIELDS.maxDiscountAmount.nullable().optional(),
    usageLimit: COUPON_FIELDS.usageLimit.nullable().optional(),
    perCustomerLimit: COUPON_FIELDS.perCustomerLimit.nullable().optional(),
    description: COUPON_FIELDS.description.nullable().optional(),
    validFrom: COUPON_FIELDS.validFrom.optional(),
    validUntil: COUPON_FIELDS.validUntil.optional(),
    isActive: COUPON_FIELDS.isActive.optional(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateCouponDto = z.infer<typeof UpdateCouponSchema>;
