import { PaymentProvider, PaymentStatus } from '@prisma/client';

/** Single source of truth for each enum's members, reused by every Zod schema that validates one. */
export const PAYMENT_PROVIDER_VALUES = Object.values(PaymentProvider) as [
  PaymentProvider,
  ...PaymentProvider[],
];
export const PAYMENT_STATUS_VALUES = Object.values(PaymentStatus) as [
  PaymentStatus,
  ...PaymentStatus[],
];
