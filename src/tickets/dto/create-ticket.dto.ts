import { z } from 'zod';
import { TICKET_PRIORITY_VALUES } from '../tickets.constants';

export const CreateTicketSchema = z
  .object({
    subject: z.string().trim().min(3, 'subject must be at least 3 characters').max(200),
    priority: z.enum(TICKET_PRIORITY_VALUES).default('MEDIUM'),
    orderId: z.number().int().positive().optional(),
    message: z.string().trim().min(1, 'message is required').max(5000),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type CreateTicketDto = z.infer<typeof CreateTicketSchema>;
