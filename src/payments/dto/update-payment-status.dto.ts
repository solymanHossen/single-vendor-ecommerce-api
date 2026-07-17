import { z } from 'zod';
import { PAYMENT_STATUS_VALUES } from '../payments.constants';

export const UpdatePaymentStatusSchema = z
  .object({
    status: z.enum(PAYMENT_STATUS_VALUES),
    transactionId: z.string().trim().min(1).max(255).optional(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type UpdatePaymentStatusDto = z.infer<typeof UpdatePaymentStatusSchema>;
