import { z } from 'zod';
import { RETURN_STATUS_VALUES } from '../returns.constants';

export const ReturnQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(RETURN_STATUS_VALUES).optional(),
    // Only honored for ADMIN/SUPER_ADMIN callers — ReturnsService forces this
    // to the caller's own id for a plain USER regardless of what's passed here.
    userId: z.coerce.number().int().positive().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type ReturnQueryDto = z.infer<typeof ReturnQuerySchema>;
