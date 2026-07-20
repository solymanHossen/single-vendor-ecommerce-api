import { z } from 'zod';
import { ORDER_STATUS_VALUES } from '../orders.constants';

export const OrderQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(ORDER_STATUS_VALUES).optional(),
    // Only honored for ADMIN/SUPER_ADMIN callers — OrdersService forces this
    // to the caller's own id for a plain USER regardless of what's passed here.
    userId: z.coerce.number().int().positive().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type OrderQueryDto = z.infer<typeof OrderQuerySchema>;
