import { z } from 'zod';

export const ReplyReviewSchema = z
  .object({
    replyText: z.string().trim().min(1, 'replyText is required').max(2000),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type ReplyReviewDto = z.infer<typeof ReplyReviewSchema>;
