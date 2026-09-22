import { z } from 'zod';

export const ReorderHeroBannersSchema = z
  .object({
    items: z
      .array(
        z.object({
          id: z.number().int().positive(),
          sortOrder: z.number().int(),
        }),
      )
      .min(1, 'items must contain at least one entry'),
  })
  .strict();

export type ReorderHeroBannersDto = z.infer<typeof ReorderHeroBannersSchema>;
