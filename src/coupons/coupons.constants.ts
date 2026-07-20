import { DiscountType } from '@prisma/client';

/** Single source of truth for the enum's members, reused by every Zod schema that validates a discount type. */
export const DISCOUNT_TYPE_VALUES = Object.values(DiscountType) as [
  DiscountType,
  ...DiscountType[],
];
