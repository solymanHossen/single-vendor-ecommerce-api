import { StockMovementType } from '@prisma/client';

/** Per product/variant. Higher is almost certainly a typo (a real store sees a warehouse first). */
export const MAX_STOCK = 100_000;

/** Store default until Settings says otherwise. */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

/** Sales velocity window and the cover a reorder suggestion aims for. */
export const SALES_WINDOW_DAYS = 30;
export const TARGET_COVER_DAYS = 30;

/** What staff can record by hand (sales, cancellations and returns are automatic). */
export const MANUAL_ADJUSTMENTS = ['RECEIVED', 'DAMAGED', 'LOST', 'CORRECTION', 'RECOUNT'] as const;
export type ManualAdjustment = (typeof MANUAL_ADJUSTMENTS)[number];

export const MOVEMENT_TYPE_VALUES = Object.values(StockMovementType) as [
  StockMovementType,
  ...StockMovementType[],
];

export const MOVEMENT_LABEL: Record<StockMovementType, string> = {
  INITIAL: 'Opening balance',
  SALE: 'Sold',
  ORDER_CANCELLED: 'Order cancelled',
  RETURN_RESTOCKED: 'Returned to stock',
  RETURN_WRITTEN_OFF: 'Return written off',
  RECEIVED: 'Received',
  DAMAGED: 'Damaged',
  LOST: 'Lost or stolen',
  CORRECTION: 'Correction',
  RECOUNT: 'Recount',
  IMPORT: 'CSV import',
};

export const MAX_IMPORT_ROWS = 2000;

export const LOW_STOCK_DIGEST_LOCK = 'lock:low-stock-digest';
export const STOCK_ALERT_LOCK = 'lock:back-in-stock';
export const STOCK_ALERT_BATCH = 200;
