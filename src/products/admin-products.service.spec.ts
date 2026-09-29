import { Test, type TestingModule } from '@nestjs/testing';
import { AdminProductsService } from './admin-products.service';
import { PrismaService } from '../database/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { stockLevelWhere } from '../inventory/stock-levels';
import type { AdminProductQueryDto } from './dto/admin-product-query.dto';

const STORE_THRESHOLD = 5;

// Stand-in for the `products.low_stock_threshold` column reference.
const thresholdField = { modelName: 'Product', name: 'lowStockThreshold' };

// Plain functions so clearAllMocks/resetAllMocks can't wipe them.
const settingsStub = {
  getSettings: () => Promise.resolve({ lowStockThreshold: STORE_THRESHOLD }),
};

const mockPrisma = {
  product: {
    fields: { lowStockThreshold: thresholdField },
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  // Batched (array) transaction: resolves every query in order.
  $transaction: jest.fn(),
};

const baseQuery: AdminProductQueryDto = {
  page: 1,
  limit: 20,
  status: 'all',
  stock: 'all',
  sortBy: 'updatedAt',
  sortOrder: 'desc',
};

const row = {
  id: 7,
  name: 'Sony WH-1000XM6',
  slug: 'sony-wh-1000xm6',
  sku: 'SONY-XM6',
  basePrice: '42000.00',
  discountPrice: '38500.00',
  stockQuantity: 3,
  isPublished: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  category: { id: 4, name: 'Audio' },
  images: [{ url: 'https://cdn.example.com/xm6.jpg' }],
  _count: { variants: 2, orderItems: 5 },
};

type FindManyArgs = { where: Record<string, unknown>; orderBy: unknown; skip: number };

describe('AdminProductsService', () => {
  let service: AdminProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminProductsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SettingsService, useValue: settingsStub },
      ],
    }).compile();

    service = module.get<AdminProductsService>(AdminProductsService);
    jest.clearAllMocks();
    mockPrisma.product.findMany.mockImplementation((args: FindManyArgs) => args);
    mockPrisma.product.count.mockImplementation((args: { where: unknown }) => args);
    mockPrisma.$transaction.mockResolvedValue([[row], 41, 82, 80, 3, 2]);
  });

  function lowWhere(): Record<string, unknown> {
    return stockLevelWhere(
      'low',
      STORE_THRESHOLD,
      thresholdField as unknown as Parameters<typeof stockLevelWhere>[2],
    );
  }

  function queries(): { page: FindManyArgs; counts: Array<{ where: Record<string, unknown> }> } {
    const batch = mockPrisma.$transaction.mock.calls[0][0] as unknown[];
    return {
      page: batch[0] as FindManyArgs,
      counts: batch.slice(1) as Array<{ where: Record<string, unknown> }>,
    };
  }

  describe('findAll()', () => {
    it('maps rows, pagination and tab counts from a single batched round trip', async () => {
      const result = await service.findAll(baseQuery);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          id: 7,
          thumbnailUrl: 'https://cdn.example.com/xm6.jpg',
          category: { id: 4, name: 'Audio' },
          variantCount: 2,
          orderCount: 5,
        }),
      );
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 41, totalPages: 3 });
      expect(result.summary).toEqual({
        total: 82,
        published: 80,
        draft: 2,
        lowStock: 3,
        outOfStock: 2,
        lowStockThreshold: STORE_THRESHOLD,
      });
    });

    it('returns a null thumbnail when the product has no images', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[{ ...row, images: [] }], 1, 1, 0, 0, 0]);

      const result = await service.findAll(baseQuery);

      expect(result.items[0]?.thumbnailUrl).toBeNull();
    });

    it('applies status and stock to the page but not to the tab counts', async () => {
      await service.findAll({ ...baseQuery, status: 'draft', stock: 'low', categoryId: 4 });

      const { page, counts } = queries();
      expect(page.where).toEqual({
        categoryId: 4,
        isPublished: false,
        AND: [
          { stockQuantity: { gt: 0 } },
          {
            OR: [
              { lowStockThreshold: null, stockQuantity: { lte: STORE_THRESHOLD } },
              { lowStockThreshold: { not: null }, stockQuantity: { lte: thresholdField } },
            ],
          },
        ],
      });
      // Scope-only count for the "All" tab: category kept, status/stock dropped.
      expect(counts[1]?.where).toEqual({ categoryId: 4 });
      expect(counts[2]?.where).toEqual({ categoryId: 4, isPublished: true });
      expect(counts[3]?.where).toEqual({ categoryId: 4, ...lowWhere() });
      expect(counts[4]?.where).toEqual({ categoryId: 4, stockQuantity: 0 });
    });

    it('searches name, product SKU and variant SKU case-insensitively', async () => {
      await service.findAll({ ...baseQuery, search: 'xm6' });

      expect(queries().page.where['OR']).toEqual([
        { name: { contains: 'xm6', mode: 'insensitive' } },
        { sku: { contains: 'xm6', mode: 'insensitive' } },
        { variants: { some: { sku: { contains: 'xm6', mode: 'insensitive' } } } },
      ]);
    });

    it('treats "in stock" as above the low-stock threshold', async () => {
      await service.findAll({ ...baseQuery, stock: 'in' });

      expect(queries().page.where['AND']).toEqual([
        { stockQuantity: { gt: 0 } },
        {
          NOT: {
            OR: [
              { lowStockThreshold: null, stockQuantity: { lte: STORE_THRESHOLD } },
              { lowStockThreshold: { not: null }, stockQuantity: { lte: thresholdField } },
            ],
          },
        },
      ]);
    });

    it("compares against each product's own threshold column when it has one", async () => {
      await service.findAll({ ...baseQuery, stock: 'low' });

      const and = queries().page.where['AND'] as Array<{ OR?: Array<Record<string, unknown>> }>;
      expect(and[1]?.OR?.[1]).toEqual({
        lowStockThreshold: { not: null },
        stockQuantity: { lte: mockPrisma.product.fields.lowStockThreshold },
      });
    });

    it('orders by the chosen field with an id tie-break and pages correctly', async () => {
      await service.findAll({ ...baseQuery, sortBy: 'basePrice', sortOrder: 'asc', page: 3 });

      const { page } = queries();
      expect(page.orderBy).toEqual([{ basePrice: 'asc' }, { id: 'asc' }]);
      expect(page.skip).toBe(40);
    });

    it('reports zero pages for an empty result', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[], 0, 0, 0, 0, 0]);

      const result = await service.findAll(baseQuery);

      expect(result.meta.totalPages).toBe(0);
    });
  });

  describe('setPublished()', () => {
    it('updates every selected product in one statement', async () => {
      mockPrisma.product.updateMany.mockResolvedValueOnce({ count: 3 });

      const result = await service.setPublished({ ids: [1, 2, 3], isPublished: true });

      expect(mockPrisma.product.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2, 3] } },
        data: { isPublished: true },
      });
      expect(result).toEqual({ updated: 3 });
    });
  });
});
