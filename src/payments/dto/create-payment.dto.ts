import { z } from 'zod';
import { PAYMENT_PROVIDER_VALUES } from '../payments.constants';

const MAX_DECIMAL_AMOUNT = 999_999_999.99;

export const CreatePaymentSchema = z
  .object({
    orderId: z.number().int().positive(),
    provider: z.enum(PAYMENT_PROVIDER_VALUES),
    amount: z.number().positive().max(MAX_DECIMAL_AMOUNT),
    transactionId: z.string().trim().min(1).max(255).optional(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type CreatePaymentDto = z.infer<typeof CreatePaymentSchema>;
