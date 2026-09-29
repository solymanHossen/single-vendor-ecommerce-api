import { z } from 'zod';
import { RETURN_STATUS_VALUES } from '../returns.constants';

export const UpdateReturnStatusSchema = z
  .object({
    status: z.enum(RETURN_STATUS_VALUES),
    adminNote: z.string().trim().max(2000).optional(),
    /** When refunding: put the items back in stock (default) or write them off. */
    restock: z.boolean().optional(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type UpdateReturnStatusDto = z.infer<typeof UpdateReturnStatusSchema>;
