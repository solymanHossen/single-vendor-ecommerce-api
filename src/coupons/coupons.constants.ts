import { DiscountType } from '@prisma/client';

/** Single source of truth for the enum's members, reused by every Zod schema that validates a discount type. */
export const DISCOUNT_TYPE_VALUES = Object.values(DiscountType) as [
  DiscountType,
  ...DiscountType[],
];

/**
 * Where a coupon is in its life, derived from isActive, the validity window
 * and usage — never stored, so it can't drift. Order = precedence.
 */
export const COUPON_STATUSES = ['DISABLED', 'EXPIRED', 'SCHEDULED', 'USED_UP', 'ACTIVE'] as const;
export type CouponStatus = (typeof COUPON_STATUSES)[number];

export const MAX_DECIMAL_AMOUNT = 999_999_999.99;

/** How many of a coupon's latest orders its detail view lists. */
export const COUPON_RECENT_ORDERS = 8;

const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/** Shopper-facing amount, e.g. ৳1,000 — matches the storefront's formatting. */
export function formatTaka(value: { toString(): string }): string {
  return `৳${money.format(Number(value.toString()))}`;
}
