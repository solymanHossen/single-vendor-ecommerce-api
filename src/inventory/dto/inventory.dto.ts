import { z } from 'zod';
import { MANUAL_ADJUSTMENTS, MAX_STOCK, MOVEMENT_TYPE_VALUES } from '../inventory.constants';

export const InventoryQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    level: z.enum(['all', 'out', 'low', 'ok']).default('all'),
    search: z.string().trim().min(1).max(150).optional(),
    sort: z
      .enum(['attention', 'stock_asc', 'stock_desc', 'sold_desc', 'name'])
      .default('attention'),
  })
  .strict();
export type InventoryQueryDto = z.infer<typeof InventoryQuerySchema>;

export const AdjustStockSchema = z
  .object({
    productId: z.number().int().positive(),
    variantId: z.number().int().positive().nullable().default(null),
    type: z.enum(MANUAL_ADJUSTMENTS),
    /**
     * RECEIVED / DAMAGED / LOST: how many units (positive).
     * CORRECTION: signed change (e.g. −3). RECOUNT: the counted total.
     */
    quantity: z.number().int().min(-MAX_STOCK).max(MAX_STOCK),
    note: z.string().trim().max(300).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (['RECEIVED', 'DAMAGED', 'LOST'].includes(data.type) && data.quantity <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['quantity'],
        message: 'Enter how many units (more than 0).',
      });
    }
    if (data.type === 'CORRECTION' && data.quantity === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['quantity'],
        message: 'A correction must change the count.',
      });
    }
    if (data.type === 'RECOUNT' && data.quantity < 0) {
      ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'A count can’t be negative.' });
    }
  });
export type AdjustStockDto = z.infer<typeof AdjustStockSchema>;

export const MovementQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(30),
    productId: z.coerce.number().int().positive().optional(),
    variantId: z.coerce.number().int().positive().optional(),
    type: z.enum(MOVEMENT_TYPE_VALUES).optional(),
  })
  .strict();
export type MovementQueryDto = z.infer<typeof MovementQuerySchema>;

export const ImportStockSchema = z
  .object({
    /** CSV text with a header row containing `sku` and `on_hand` (or `quantity`). */
    csv: z.string().min(1).max(500_000),
    /** true = preview only. */
    dryRun: z.boolean().default(true),
  })
  .strict();
export type ImportStockDto = z.infer<typeof ImportStockSchema>;

export const StockAlertSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    variantId: z.number().int().positive().nullable().default(null),
  })
  .strict();
export type StockAlertDto = z.infer<typeof StockAlertSchema>;
