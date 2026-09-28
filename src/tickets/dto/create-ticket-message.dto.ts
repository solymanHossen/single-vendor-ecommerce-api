import { z } from 'zod';
import { TICKET_ATTACHMENTS, TICKET_MESSAGE } from './create-ticket.dto';

export const CreateTicketMessageSchema = z
  .object({
    message: TICKET_MESSAGE,
    attachments: TICKET_ATTACHMENTS,
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type CreateTicketMessageDto = z.infer<typeof CreateTicketMessageSchema>;

export const StaffTicketMessageSchema = z
  .object({
    message: TICKET_MESSAGE,
    attachments: TICKET_ATTACHMENTS,
    /** A staff-only note instead of a reply. */
    internal: z.boolean().default(false),
    /** Status after a reply (default WAITING — the customer's turn). */
    status: z.enum(['IN_PROGRESS', 'WAITING', 'RESOLVED']).optional(),
  })
  .strict();

export type StaffTicketMessageDto = z.infer<typeof StaffTicketMessageSchema>;

export const RateTicketSchema = z.object({ satisfied: z.boolean() }).strict();
export type RateTicketDto = z.infer<typeof RateTicketSchema>;
