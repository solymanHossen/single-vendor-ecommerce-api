import { z } from 'zod';

export const CreateTicketMessageSchema = z
  .object({
    message: z.string().trim().min(1, 'message is required').max(5000),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type CreateTicketMessageDto = z.infer<typeof CreateTicketMessageSchema>;
