import { z } from 'zod';
import { TICKET_PRIORITY_VALUES, TICKET_STATUS_VALUES } from '../tickets.constants';

export const TicketQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(TICKET_STATUS_VALUES).optional(),
    priority: z.enum(TICKET_PRIORITY_VALUES).optional(),
    // Only honored for ADMIN/SUPER_ADMIN callers — TicketsService forces this
    // to the caller's own id for a plain USER regardless of what's passed here.
    userId: z.coerce.number().int().positive().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type TicketQueryDto = z.infer<typeof TicketQuerySchema>;
