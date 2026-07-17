import { z } from 'zod';
import { RETURN_STATUS_VALUES } from '../returns.constants';

export const UpdateReturnStatusSchema = z
  .object({
    status: z.enum(RETURN_STATUS_VALUES),
    adminNote: z.string().trim().max(2000).optional(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type UpdateReturnStatusDto = z.infer<typeof UpdateReturnStatusSchema>;
