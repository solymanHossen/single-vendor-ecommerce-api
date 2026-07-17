import { z } from 'zod';
import { TICKET_STATUS_VALUES } from '../tickets.constants';

export const UpdateTicketStatusSchema = z
  .object({
    status: z.enum(TICKET_STATUS_VALUES),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type UpdateTicketStatusDto = z.infer<typeof UpdateTicketStatusSchema>;
