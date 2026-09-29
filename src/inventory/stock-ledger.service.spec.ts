import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { InsufficientStockError, StockLedgerService } from './stock-ledger.service';
import { MAX_STOCK } from './inventory.constants';

type Rows = Array<{ stock: number }>;

/** Tagged-template calls arrive as (strings, ...values); join the strings to route them. */
function sqlOf(call: unknown[]): string {
  return (call[0] as TemplateStringsArray).join('?');
}

const mockTx = {
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  stockMovement: { create: jest.fn() },
};
const tx = mockTx as unknown as Prisma.TransactionClient;

/**
 * Routes the conditional UPDATE … RETURNING and the SELECT … FOR UPDATE to
 * canned rows: `updated` is what the guarded update returns (empty when the
 * guard rejected the change), `locked` what the row lock reads back.
 */
function arrange(updated: Rows, locked: Rows): void {
  mockTx.$queryRaw.mockImplementation((...call: unknown[]) =>
    Promise.resolve(sqlOf(call).includes('RETURNING') ? updated : locked),
  );
}

describe('StockLedgerService', () => {
  const ledger = new StockLedgerService();

  beforeEach(() => {
    jest.resetAllMocks();
    mockTx.stockMovement.create.mockResolvedValue({ id: 1 });
    mockTx.$executeRaw.mockResolvedValue(1);
  });

  describe('apply()', () => {
    it('decrements with a guarded update and records the movement with its balance', async () => {
      arrange([{ stock: 3 }], []);

      await ledger.apply(tx, [
        { productId: 5, variantId: null, delta: -2, type: 'SALE', orderId: 301, actorId: 7 },
      ]);

      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
      const [call] = mockTx.$queryRaw.mock.calls as unknown[][];
      expect(sqlOf(call ?? [])).toContain('UPDATE products');
      expect(sqlOf(call ?? [])).toContain('>= 0');
      // Values: delta, id, then the non-negative guard and the add-only cap guard.
      expect(call?.slice(1)).toEqual([-2, 5, -2, -2, -2, MAX_STOCK]);
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith({
        data: {
          productId: 5,
          variantId: null,
          type: 'SALE',
          quantity: -2,
          balanceAfter: 3,
          note: null,
          orderId: 301,
          actorId: 7,
        },
        select: { id: true },
      });
      // Simple product: no variant totals to re-sync.
      expect(mockTx.$executeRaw).not.toHaveBeenCalled();
    });

    it('updates the variant row and re-syncs its product total once per product', async () => {
      arrange([{ stock: 8 }], []);

      await ledger.apply(tx, [
        { productId: 9, variantId: 91, delta: 3, type: 'RECEIVED' },
        { productId: 9, variantId: 92, delta: 1, type: 'RECEIVED' },
      ]);

      const calls = mockTx.$queryRaw.mock.calls as unknown[][];
      expect(calls.every((call) => sqlOf(call).includes('UPDATE product_variants'))).toBe(true);
      expect(mockTx.stockMovement.create).toHaveBeenCalledTimes(2);
      expect(mockTx.$executeRaw).toHaveBeenCalledTimes(1);
      const [sync] = mockTx.$executeRaw.mock.calls as unknown[][];
      expect(sqlOf(sync ?? [])).toContain('SUM(stock_quantity)');
      expect(sync?.slice(1)).toEqual([9, 9]);
    });

    it('throws InsufficientStockError when a decrement would go below zero', async () => {
      arrange([], [{ stock: 1 }]);

      await expect(
        ledger.apply(tx, [{ productId: 5, variantId: null, delta: -2, type: 'SALE' }]),
      ).rejects.toEqual(new InsufficientStockError({ productId: 5, variantId: null }));
      // The guard rejected the update; the row lock confirms why.
      const calls = mockTx.$queryRaw.mock.calls as unknown[][];
      expect(sqlOf(calls[1] ?? [])).toContain('FOR UPDATE');
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('treats a decrement on a missing unit as insufficient stock', async () => {
      arrange([], []);

      await expect(
        ledger.apply(tx, [{ productId: 5, variantId: 50, delta: -1, type: 'DAMAGED' }]),
      ).rejects.toEqual(new InsufficientStockError({ productId: 5, variantId: 50 }));
    });

    it('skips an increment for a unit deleted since (e.g. restocking an old order)', async () => {
      arrange([], []);

      await ledger.apply(tx, [
        { productId: 5, variantId: null, delta: 2, type: 'RETURN_RESTOCKED', orderId: 301 },
      ]);

      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('refuses to take stock above the maximum', async () => {
      arrange([], [{ stock: MAX_STOCK - 1 }]);

      await expect(
        ledger.apply(tx, [{ productId: 5, variantId: null, delta: 5, type: 'RECEIVED' }]),
      ).rejects.toThrow(BadRequestException);
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('ignores zero moves, except a write-off which is still recorded', async () => {
      arrange([{ stock: 4 }], []);

      await ledger.apply(tx, [
        { productId: 5, variantId: null, delta: 0, type: 'CORRECTION' },
        {
          productId: 6,
          variantId: null,
          delta: 0,
          type: 'RETURN_WRITTEN_OFF',
          note: '1 unit(s) not resellable',
        },
      ]);

      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(mockTx.stockMovement.create).toHaveBeenCalledTimes(1);
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 6,
            type: 'RETURN_WRITTEN_OFF',
            quantity: 0,
            balanceAfter: 4,
            note: '1 unit(s) not resellable',
          }) as unknown,
        }),
      );
    });
  });

  describe('set()', () => {
    it('locks the row, then applies the difference to reach the count', async () => {
      mockTx.$queryRaw.mockImplementation((...call: unknown[]) =>
        Promise.resolve(sqlOf(call).includes('FOR UPDATE') ? [{ stock: 10 }] : [{ stock: 4 }]),
      );

      const result = await ledger.set(tx, { productId: 5, variantId: null }, 4, {
        type: 'RECOUNT',
        actorId: 9,
        note: 'Shelf count',
      });

      expect(result).toEqual({ before: 10, after: 4 });
      const calls = mockTx.$queryRaw.mock.calls as unknown[][];
      expect(sqlOf(calls[0] ?? [])).toContain('FOR UPDATE');
      expect(calls[1]?.[1]).toBe(-6);
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'RECOUNT',
            quantity: -6,
            balanceAfter: 4,
            actorId: 9,
            note: 'Shelf count',
          }) as unknown,
        }),
      );
    });

    it('records nothing when the count is unchanged', async () => {
      mockTx.$queryRaw.mockResolvedValue([{ stock: 7 }]);

      await expect(
        ledger.set(tx, { productId: 5, variantId: 50 }, 7, { type: 'IMPORT' }),
      ).resolves.toEqual({ before: 7, after: 7 });
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });

    it.each([-1, 1.5, MAX_STOCK + 1])('rejects %p without touching the row', async (count) => {
      await expect(
        ledger.set(tx, { productId: 5, variantId: null }, count, { type: 'RECOUNT' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockTx.$queryRaw).not.toHaveBeenCalled();
    });

    it('rejects a unit that no longer exists', async () => {
      mockTx.$queryRaw.mockResolvedValue([]);

      await expect(
        ledger.set(tx, { productId: 5, variantId: null }, 3, { type: 'RECOUNT' }),
      ).rejects.toThrow(new BadRequestException('That product or variant no longer exists.'));
    });
  });
});
