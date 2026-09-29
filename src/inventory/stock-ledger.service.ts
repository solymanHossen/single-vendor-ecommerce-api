import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { MAX_STOCK } from './inventory.constants';

/** One stock unit: a simple product (variantId null) or one variant. */
export interface StockUnit {
  productId: number;
  variantId: number | null;
}

export interface StockMove extends StockUnit {
  /** Signed: −2 takes two units away. */
  delta: number;
  type: StockMovementType;
  note?: string | null;
  orderId?: number | null;
  actorId?: number | null;
}

/** Thrown when a decrement would take a unit below zero (checkout maps it to "sold out"). */
export class InsufficientStockError extends Error {
  constructor(readonly unit: StockUnit) {
    super('Not enough stock');
  }
}

/**
 * The only way stock changes. Every move is one conditional UPDATE … RETURNING
 * (so concurrent checkouts can't oversell, and no read-modify-write can lose
 * an update) plus a ledger row with the resulting balance — all inside the
 * caller's transaction, so counts and history always agree.
 */
@Injectable()
export class StockLedgerService {
  async apply(tx: Prisma.TransactionClient, moves: readonly StockMove[]): Promise<void> {
    for (const move of moves) {
      if (move.delta === 0 && move.type !== StockMovementType.RETURN_WRITTEN_OFF) continue;
      const balance = await this.bump(tx, move, move.delta);
      if (balance === null) continue; // a unit deleted since (e.g. restocking an old order)
      await tx.stockMovement.create({
        data: {
          productId: move.productId,
          variantId: move.variantId,
          type: move.type,
          quantity: move.delta,
          balanceAfter: balance,
          note: move.note ?? null,
          orderId: move.orderId ?? null,
          actorId: move.actorId ?? null,
        },
        select: { id: true },
      });
    }
    await this.syncVariantProducts(tx, moves);
  }

  /** Sets an exact count (recount, editor, import) and records the difference. */
  async set(
    tx: Prisma.TransactionClient,
    unit: StockUnit,
    count: number,
    meta: Omit<StockMove, keyof StockUnit | 'delta'>,
  ): Promise<{ before: number; after: number }> {
    if (!Number.isInteger(count) || count < 0 || count > MAX_STOCK) {
      throw new BadRequestException(
        `Stock must be a whole number from 0 to ${MAX_STOCK.toLocaleString('en-US')}.`,
      );
    }
    const before = await this.lockedCount(tx, unit);
    if (before === null) throw new BadRequestException('That product or variant no longer exists.');
    await this.apply(tx, [{ ...unit, ...meta, delta: count - before }]);
    return { before, after: count };
  }

  /** Current count, row-locked until the transaction ends. */
  async lockedCount(tx: Prisma.TransactionClient, unit: StockUnit): Promise<number | null> {
    const rows =
      unit.variantId === null
        ? await tx.$queryRaw<Array<{ stock: number }>>`
            SELECT stock_quantity AS stock FROM products WHERE id = ${unit.productId} FOR UPDATE`
        : await tx.$queryRaw<Array<{ stock: number }>>`
            SELECT stock_quantity AS stock FROM product_variants
            WHERE id = ${unit.variantId} AND product_id = ${unit.productId} FOR UPDATE`;
    return rows[0]?.stock ?? null;
  }

  /**
   * New balance, or null when the unit no longer exists (only for increments).
   * The MAX_STOCK cap only stops *adding* — selling or removing stock always
   * works, even on a unit that was over the cap before it existed.
   */
  private async bump(
    tx: Prisma.TransactionClient,
    unit: StockUnit,
    delta: number,
  ): Promise<number | null> {
    const rows =
      unit.variantId === null
        ? await tx.$queryRaw<Array<{ stock: number }>>`
            UPDATE products SET stock_quantity = stock_quantity + ${delta}, updated_at = NOW()
            WHERE id = ${unit.productId}
              AND stock_quantity + ${delta} >= 0
              AND (${delta} <= 0 OR stock_quantity + ${delta} <= ${MAX_STOCK})
            RETURNING stock_quantity AS stock`
        : await tx.$queryRaw<Array<{ stock: number }>>`
            UPDATE product_variants SET stock_quantity = stock_quantity + ${delta}, updated_at = NOW()
            WHERE id = ${unit.variantId} AND product_id = ${unit.productId}
              AND stock_quantity + ${delta} >= 0
              AND (${delta} <= 0 OR stock_quantity + ${delta} <= ${MAX_STOCK})
            RETURNING stock_quantity AS stock`;
    if (rows[0]) return rows[0].stock;

    const current = await this.lockedCount(tx, unit);
    if (current === null) {
      if (delta >= 0) return null;
      throw new InsufficientStockError(unit);
    }
    if (current + delta < 0) throw new InsufficientStockError(unit);
    throw new BadRequestException(
      `That would take stock above ${MAX_STOCK.toLocaleString('en-US')} — check the quantity.`,
    );
  }

  /** A product with variants shows the sum of its variants. */
  private async syncVariantProducts(
    tx: Prisma.TransactionClient,
    units: readonly StockUnit[],
  ): Promise<void> {
    const productIds = [
      ...new Set(units.filter((u) => u.variantId !== null).map((u) => u.productId)),
    ];
    for (const productId of productIds) {
      await tx.$executeRaw`
        UPDATE products SET stock_quantity = COALESCE(
          (SELECT SUM(stock_quantity) FROM product_variants WHERE product_id = ${productId}), 0),
          updated_at = NOW()
        WHERE id = ${productId}`;
    }
  }
}
