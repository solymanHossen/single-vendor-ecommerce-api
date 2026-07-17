import { z } from 'zod';
import { ORDER_STATUS_VALUES } from '../orders.constants';

export const UpdateOrderStatusSchema = z
  .object({
    status: z.enum(ORDER_STATUS_VALUES),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type UpdateOrderStatusDto = z.infer<typeof UpdateOrderStatusSchema>;
