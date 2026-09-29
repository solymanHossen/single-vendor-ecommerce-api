import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../database/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { InsufficientStockError, StockLedgerService } from './stock-ledger.service';
import { parseCsv } from './csv';
import type { AdjustStockDto } from './dto/inventory.dto';

// Plain function so jest.resetAllMocks can't wipe it.
const settingsStub = { getSettings: () => Promise.resolve({ lowStockThreshold: 5 }) };

const mockLedger = { apply: jest.fn(), set: jest.fn() };

const mockTx = { marker: 'tx' };

const mockPrisma = {
  product: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
  productVariant: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
  stockAlert: { upsert: jest.fn() },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
};

/** One row of the `enriched` unit query. */
function unitRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    product_id: 5,
    variant_id: null,
    name: 'USB-C Cable',
    variant_label: null,
    sku: 'CABLE-1',
    category: 'Accessories',
    image_url: null,
    is_published: true,
    on_hand: 12,
    threshold: 5,
    custom_threshold: false,
    level: 'ok',
    sold: 30,
    waiting: 0,
    price: '450.00',
    ...overrides,
  };
}

function adjustDto(overrides: Partial<AdjustStockDto>): AdjustStockDto {
  return { productId: 5, variantId: null, type: 'RECEIVED', quantity: 3, ...overrides };
}

/** A simple (variant-free) product. */
function simpleProduct(): void {
  mockPrisma.product.findUnique.mockResolvedValue({
    _count: { variants: 0 },
    stockQuantity: 2,
  });
}

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StockLedgerService, useValue: mockLedger },
        { provide: SettingsService, useValue: settingsStub },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    jest.resetAllMocks();
    mockPrisma.$transaction.mockImplementation((run: (tx: typeof mockTx) => unknown) =>
      run(mockTx),
    );
    mockPrisma.$queryRaw.mockResolvedValue([unitRow()]);
    mockPrisma.stockAlert.upsert.mockResolvedValue({ id: 1 });
  });

  describe('adjust()', () => {
    it('adds received units through the ledger and returns the refreshed unit', async () => {
      simpleProduct();

      const unit = await service.adjust(adjustDto({ type: 'RECEIVED', quantity: 3 }), 9);

      expect(mockLedger.apply).toHaveBeenCalledWith(mockTx, [
        { productId: 5, variantId: null, delta: 3, type: 'RECEIVED', note: null, actorId: 9 },
      ]);
      expect(unit).toEqual(
        expect.objectContaining({ productId: 5, onHand: 12, sold30d: 30, daysOfCover: 12 }),
      );
    });

    it('takes damaged units away', async () => {
      simpleProduct();

      await service.adjust(adjustDto({ type: 'DAMAGED', quantity: 2, note: 'Dropped' }), 9);

      expect(mockLedger.apply).toHaveBeenCalledWith(mockTx, [
        expect.objectContaining({ delta: -2, type: 'DAMAGED', note: 'Dropped' }),
      ]);
    });

    it('applies a correction as the signed change it is', async () => {
      simpleProduct();

      await service.adjust(adjustDto({ type: 'CORRECTION', quantity: -4 }), 9);

      expect(mockLedger.apply).toHaveBeenCalledWith(mockTx, [
        expect.objectContaining({ delta: -4, type: 'CORRECTION' }),
      ]);
    });

    it('explains, with the current count, when more is removed than is on hand', async () => {
      simpleProduct();
      mockLedger.apply.mockRejectedValueOnce(
        new InsufficientStockError({ productId: 5, variantId: null }),
      );

      await expect(service.adjust(adjustDto({ type: 'DAMAGED', quantity: 5 }), 9)).rejects.toThrow(
        new BadRequestException("Only 2 in stock — you can't take away 5."),
      );
    });

    it('records a recount as an exact set, not a delta', async () => {
      simpleProduct();

      await service.adjust(adjustDto({ type: 'RECOUNT', quantity: 7, note: 'Shelf count' }), 9);

      expect(mockLedger.set).toHaveBeenCalledWith(mockTx, { productId: 5, variantId: null }, 7, {
        type: 'RECOUNT',
        note: 'Shelf count',
        actorId: 9,
      });
      expect(mockLedger.apply).not.toHaveBeenCalled();
    });

    it('rejects a product-level adjustment for a product that keeps stock per variant', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ _count: { variants: 2 } });

      await expect(service.adjust(adjustDto({}), 9)).rejects.toThrow(
        new BadRequestException('This product keeps stock per variant — choose a variant.'),
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("404s for a variant that isn't this product's", async () => {
      mockPrisma.productVariant.findFirst.mockResolvedValue(null);

      await expect(service.adjust(adjustDto({ variantId: 77 }), 9)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockPrisma.productVariant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 77, productId: 5 } }),
      );
    });
  });

  describe('importCsv()', () => {
    function arrangeCatalogue(): void {
      mockPrisma.productVariant.findMany.mockResolvedValue([
        {
          id: 51,
          sku: 'TEE-RED-M',
          productId: 50,
          stockQuantity: 4,
          product: { name: 'T-shirt' },
        },
      ]);
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 5, sku: 'CABLE-1', name: 'USB-C Cable', stockQuantity: 12, _count: { variants: 0 } },
        { id: 50, sku: 'TEE', name: 'T-shirt', stockQuantity: 4, _count: { variants: 3 } },
      ]);
    }

    it('requires a header naming the sku and on_hand columns', async () => {
      await expect(service.importCsv({ csv: 'code,count\nA,1', dryRun: true }, 9)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses a file with a header but no rows', async () => {
      await expect(service.importCsv({ csv: 'sku,on_hand\n,\n', dryRun: true }, 9)).rejects.toThrow(
        new BadRequestException('The file has no rows to import.'),
      );
    });

    it('previews every row on a dry run without writing', async () => {
      arrangeCatalogue();
      const csv = [
        'SKU,Product,On_Hand',
        'CABLE-1,USB-C Cable,20',
        'TEE-RED-M,T-shirt,4',
        'CABLE-1,USB-C Cable,21',
        'NOPE,Ghost,1',
        'TEE,T-shirt,9',
        'CABLE-2,Other,-1',
      ].join('\r\n');

      const result = await service.importCsv({ csv, dryRun: true }, 9);

      expect(result).toEqual(
        expect.objectContaining({ applied: false, changed: 1, unchanged: 1, errors: 4 }),
      );
      expect(result.rows).toEqual([
        { line: 2, sku: 'CABLE-1', name: 'USB-C Cable', current: 12, next: 20, error: null },
        { line: 3, sku: 'TEE-RED-M', name: 'T-shirt', current: 4, next: 4, error: null },
        expect.objectContaining({ line: 4, error: 'This SKU appears more than once' }),
        expect.objectContaining({ line: 5, error: 'No product or variant has this SKU' }),
        {
          line: 6,
          sku: 'TEE',
          name: 'T-shirt',
          current: 4,
          next: null,
          error: 'Stock is kept per variant — use the variant SKUs',
        },
        expect.objectContaining({
          line: 7,
          error: 'Stock must be a whole number from 0 to 100,000',
        }),
      ]);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockLedger.set).not.toHaveBeenCalled();
    });

    it('refuses to apply a file that still has errors', async () => {
      arrangeCatalogue();

      await expect(
        service.importCsv({ csv: 'sku,on_hand\nCABLE-1,20\nNOPE,1', dryRun: false }, 9),
      ).rejects.toThrow(new ConflictException('Fix the 1 highlighted row before importing.'));
      expect(mockLedger.set).not.toHaveBeenCalled();
    });

    it('applies a clean file as IMPORT sets in one transaction', async () => {
      arrangeCatalogue();

      const result = await service.importCsv(
        { csv: 'sku,quantity\nCABLE-1,20\nTEE-RED-M,6\n', dryRun: false },
        9,
      );

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockLedger.set).toHaveBeenNthCalledWith(
        1,
        mockTx,
        { productId: 5, variantId: null },
        20,
        {
          type: 'IMPORT',
          actorId: 9,
          note: 'CSV import',
        },
      );
      expect(mockLedger.set).toHaveBeenNthCalledWith(
        2,
        mockTx,
        { productId: 50, variantId: 51 },
        6,
        {
          type: 'IMPORT',
          actorId: 9,
          note: 'CSV import',
        },
      );
      expect(result).toEqual(
        expect.objectContaining({ applied: true, changed: 2, unchanged: 0, errors: 0 }),
      );
    });
  });

  describe('subscribe()', () => {
    it('404s for a product that is missing or unpublished', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);

      await expect(
        service.subscribe(5, { email: 'a@b.com', variantId: null }, null),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockPrisma.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 5, isPublished: true } }),
      );
    });

    it('asks for an option on a product with variants', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        stockQuantity: 0,
        _count: { variants: 2 },
      });

      await expect(
        service.subscribe(50, { email: 'a@b.com', variantId: null }, null),
      ).rejects.toThrow(new BadRequestException('Choose the option you want first.'));
      expect(mockPrisma.stockAlert.upsert).not.toHaveBeenCalled();
    });

    it('409s when the item is already in stock', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({ stockQuantity: 3, _count: { variants: 0 } });
      mockPrisma.product.findUnique.mockResolvedValue({
        _count: { variants: 0 },
        stockQuantity: 3,
      });

      await expect(
        service.subscribe(5, { email: 'a@b.com', variantId: null }, null),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(mockPrisma.stockAlert.upsert).not.toHaveBeenCalled();
    });

    it('upserts on email + unit key, re-arming an alert that was already sent', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({ stockQuantity: 0, _count: { variants: 2 } });
      mockPrisma.productVariant.findFirst.mockResolvedValue({ id: 51 });
      mockPrisma.productVariant.findUnique.mockResolvedValue({ stockQuantity: 0 });

      await expect(service.subscribe(50, { email: 'a@b.com', variantId: 51 }, 7)).resolves.toEqual({
        subscribed: true,
      });

      expect(mockPrisma.stockAlert.upsert).toHaveBeenCalledWith({
        where: { email_unitKey: { email: 'a@b.com', unitKey: '50:51' } },
        create: { email: 'a@b.com', userId: 7, productId: 50, variantId: 51, unitKey: '50:51' },
        update: { notifiedAt: null, userId: 7 },
        select: { id: true },
      });
    });

    it('keys a simple product with variant 0 and leaves the owner alone for guests', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({ stockQuantity: 0, _count: { variants: 0 } });
      mockPrisma.product.findUnique.mockResolvedValue({
        _count: { variants: 0 },
        stockQuantity: 0,
      });

      await service.subscribe(5, { email: 'guest@b.com', variantId: null }, null);

      expect(mockPrisma.stockAlert.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email_unitKey: { email: 'guest@b.com', unitKey: '5:0' } },
          update: { notifiedAt: null },
        }),
      );
    });
  });

  describe('exportCsv()', () => {
    it('exports one row per unit with a header', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        unitRow(),
        unitRow({ variant_id: 51, sku: 'TEE-RED-M', name: 'T-shirt', variant_label: 'Red · M' }),
      ]);

      const rows = parseCsv(await service.exportCsv());

      expect(rows[0]).toEqual([
        'sku',
        'product',
        'variant',
        'on_hand',
        'low_stock_threshold',
        'sold_30d',
        'status',
      ]);
      expect(rows[2]).toEqual(['TEE-RED-M', 'T-shirt', 'Red · M', '12', '5', '30', 'ok']);
    });
  });
});
