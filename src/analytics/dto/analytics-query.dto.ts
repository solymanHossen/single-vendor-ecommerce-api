import { z } from 'zod';

export const ANALYTICS_RANGES = ['7', '30', '90'] as const;

/** Reporting window in days; the previous window of equal length is the comparison base. */
export const AnalyticsQuerySchema = z
  .object({
    range: z
      .enum(ANALYTICS_RANGES)
      .default('30')
      .transform((value) => Number(value) as 7 | 30 | 90),
  })
  .strict();

export type AnalyticsQueryDto = z.infer<typeof AnalyticsQuerySchema>;
