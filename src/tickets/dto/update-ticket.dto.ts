import { z } from 'zod';
import {
  TICKET_CATEGORY_VALUES,
  TICKET_PRIORITY_VALUES,
  TICKET_STATUS_VALUES,
} from '../tickets.constants';

export const UpdateTicketSchema = z
  .object({
    status: z.enum(TICKET_STATUS_VALUES).optional(),
    priority: z.enum(TICKET_PRIORITY_VALUES).optional(),
    category: z.enum(TICKET_CATEGORY_VALUES).optional(),
    /** null unassigns. */
    assigneeId: z.number().int().positive().nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateTicketDto = z.infer<typeof UpdateTicketSchema>;
