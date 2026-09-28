import { z } from 'zod';
import {
  MAX_TICKET_ATTACHMENTS,
  MAX_TICKET_MESSAGE_LENGTH,
  TICKET_CATEGORY_VALUES,
} from '../tickets.constants';

/** Images uploaded through /storage/upload with folder=tickets. */
export const TICKET_ATTACHMENTS = z
  .array(
    z
      .string()
      .url()
      .max(500)
      .regex(/\/tickets\/[^/]+$/, 'attachments must be uploaded to the "tickets" folder'),
  )
  .max(MAX_TICKET_ATTACHMENTS, `at most ${MAX_TICKET_ATTACHMENTS} attachments`)
  .default([]);

export const TICKET_MESSAGE = z
  .string()
  .trim()
  .min(1, 'message is required')
  .max(MAX_TICKET_MESSAGE_LENGTH);

export const CreateTicketSchema = z
  .object({
    category: z.enum(TICKET_CATEGORY_VALUES),
    subject: z.string().trim().min(3, 'subject must be at least 3 characters').max(200),
    orderId: z.number().int().positive().optional(),
    message: TICKET_MESSAGE.min(10, 'Tell us a little more (at least 10 characters)'),
    attachments: TICKET_ATTACHMENTS,
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type CreateTicketDto = z.infer<typeof CreateTicketSchema>;
