import type { Prisma } from '@prisma/client';

export type StockLevel = 'in' | 'low' | 'out';

/**
 * Product-level stock filters honouring each product's own low-stock
 * threshold (or the store default). `thresholdField` is
 * `prisma.product.fields.lowStockThreshold` — a column reference, so the
 * comparison runs in the database.
 */
export function stockLevelWhere(
  level: StockLevel,
  storeThreshold: number,
  thresholdField: Prisma.FieldRef<'Product', 'Int'>,
): Prisma.ProductWhereInput {
  const atOrBelowThreshold: Prisma.ProductWhereInput = {
    OR: [
      { lowStockThreshold: null, stockQuantity: { lte: storeThreshold } },
      { lowStockThreshold: { not: null }, stockQuantity: { lte: thresholdField } },
    ],
  };
  switch (level) {
    case 'out':
      return { stockQuantity: 0 };
    case 'low':
      return { AND: [{ stockQuantity: { gt: 0 } }, atOrBelowThreshold] };
    case 'in':
      return { AND: [{ stockQuantity: { gt: 0 } }, { NOT: atOrBelowThreshold }] };
  }
}

/** The threshold that applies to a product. */
export function effectiveThreshold(
  productThreshold: number | null,
  storeThreshold: number,
): number {
  return productThreshold ?? storeThreshold;
}
