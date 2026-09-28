import { z } from 'zod';
import { TICKET_CATEGORY_VALUES, TICKET_PRIORITY_VALUES, TICKET_VIEWS } from '../tickets.constants';

/** A customer's own requests. */
export const TicketQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    state: z.enum(['active', 'resolved', 'all']).default('all'),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type TicketQueryDto = z.infer<typeof TicketQuerySchema>;

/** The staff support queue. */
export const AdminTicketQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    view: z.enum(TICKET_VIEWS).default('needs_reply'),
    priority: z.enum(TICKET_PRIORITY_VALUES).optional(),
    category: z.enum(TICKET_CATEGORY_VALUES).optional(),
    /** Subject, customer name/email, or a ticket number ("#123" or "123"). */
    search: z.string().trim().min(1).max(150).optional(),
    userId: z.coerce.number().int().positive().optional(),
  })
  .strict();

export type AdminTicketQueryDto = z.infer<typeof AdminTicketQuerySchema>;
