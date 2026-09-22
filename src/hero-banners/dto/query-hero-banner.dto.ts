import { z } from 'zod';

export const QueryHeroBannerSchema = z
  .object({
    placement: z.enum(['MAIN', 'SIDE']).optional(),
  })
  .strict();

export type QueryHeroBannerDto = z.infer<typeof QueryHeroBannerSchema>;
