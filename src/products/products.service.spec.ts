import { Test, type TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../database/prisma.service';
import type { ProductQueryDto } from './dto/query-product.dto';

const mockPrisma = {
  product: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
};

const baseQuery: ProductQueryDto = {
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

const sampleRow = {
  id: 1,
  categoryId: 2,
  name: 'iPhone 17 Pro',
  slug: 'iphone-17-pro',
  description: 'Flagship phone',
  basePrice: 999,
  discountPrice: null,
  sku: 'IPH17PRO',
  stockQuantity: 10,
  isPublished: true,
  metaTitle: null,
  metaDesc: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  category: { id: 2, name: 'Phones', slug: 'phones', iconUrl: null },
  images: [{ id: 1, url: 'https://cdn.example.com/1.jpg', isThumbnail: true }],
  variants: [
    {
      id: 201,
      sku: 'IPH17PRO-256-RED',
      price: 999,
      stockQuantity: 12,
      imageUrl: null,
      options: [
        {
          attributeOption: { id: 10, value: 'Red', attributeId: 3, attribute: { name: 'Color' } },
        },
      ],
    },
  ],
};

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('paginates results and computes totalPages', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[sampleRow], 41]);

      const result = await service.findAll({ ...baseQuery, limit: 20 });

      expect(result.meta).toEqual({ page: 1, limit: 20, total: 41, totalPages: 3 });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.category).toEqual({
        id: 2,
        name: 'Phones',
        slug: 'phones',
        iconUrl: null,
      });
    });

    it('returns zero totalPages when there are no matches', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[], 0]);

      const result = await service.findAll(baseQuery);

      expect(result.meta.totalPages).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('builds a categoryId + isPublished + inStock + search + price-range where clause', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[], 0]);

      await service.findAll({
        ...baseQuery,
        categoryId: 5,
        isPublished: true,
        inStock: true,
        search: 'phone',
        minPrice: 100,
        maxPrice: 500,
      });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            categoryId: 5,
            isPublished: true,
            stockQuantity: { gt: 0 },
            OR: [
              { name: { contains: 'phone', mode: 'insensitive' } },
              { sku: { contains: 'phone', mode: 'insensitive' } },
            ],
            basePrice: { gte: 100, lte: 500 },
          },
        }),
      );
    });

    it('filters out-of-stock products when inStock=false', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[], 0]);

      await service.findAll({ ...baseQuery, inStock: false });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { stockQuantity: { equals: 0 } } }),
      );
    });

    it('maps sortBy to the matching Prisma orderBy key', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[], 0]);

      await service.findAll({ ...baseQuery, sortBy: 'basePrice', sortOrder: 'asc' });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { basePrice: 'asc' } }),
      );
    });
  });

  describe('findOne()', () => {
    it('maps the Prisma row into a ProductEntity', async () => {
      mockPrisma.product.findUniqueOrThrow.mockResolvedValueOnce(sampleRow);

      const result = await service.findOne(1);

      expect(mockPrisma.product.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } }),
      );
      expect(result.sku).toBe('IPH17PRO');
      expect(result.images).toHaveLength(1);
      expect(result.variants).toHaveLength(1);
      expect(result.variants[0]?.options[0]).toEqual({
        attributeOptionId: 10,
        attributeId: 3,
        attributeName: 'Color',
        value: 'Red',
      });
    });
  });

  describe('create()', () => {
    it('creates a product without a nested images write when none are provided', async () => {
      mockPrisma.product.create.mockResolvedValueOnce(sampleRow);

      await service.create({
        categoryId: 2,
        name: 'iPhone 17 Pro',
        slug: 'iphone-17-pro',
        description: 'Flagship phone',
        basePrice: 999,
        sku: 'IPH17PRO',
        stockQuantity: 10,
        isPublished: true,
      });

      const callArgs = mockPrisma.product.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(callArgs.data).not.toHaveProperty('images');
    });

    it('creates a product with a nested images.create write when images are provided', async () => {
      mockPrisma.product.create.mockResolvedValueOnce(sampleRow);

      await service.create({
        categoryId: 2,
        name: 'iPhone 17 Pro',
        slug: 'iphone-17-pro',
        description: 'Flagship phone',
        basePrice: 999,
        sku: 'IPH17PRO',
        stockQuantity: 10,
        isPublished: true,
        images: [{ url: 'https://cdn.example.com/1.jpg', isThumbnail: true }],
      });

      const callArgs = mockPrisma.product.create.mock.calls[0][0] as {
        data: { images?: { create: unknown } };
      };
      expect(callArgs.data.images).toEqual({
        create: [{ url: 'https://cdn.example.com/1.jpg', isThumbnail: true }],
      });
    });
  });

  describe('update()', () => {
    it('replaces the image set with deleteMany + create when images are provided', async () => {
      mockPrisma.product.update.mockResolvedValueOnce(sampleRow);

      await service.update(1, {
        images: [{ url: 'https://cdn.example.com/2.jpg', isThumbnail: false }],
      });

      const callArgs = mockPrisma.product.update.mock.calls[0][0] as {
        data: { images?: { deleteMany: unknown; create: unknown } };
      };
      expect(callArgs.data.images).toEqual({
        deleteMany: {},
        create: [{ url: 'https://cdn.example.com/2.jpg', isThumbnail: false }],
      });
    });

    it('leaves images untouched when not provided', async () => {
      mockPrisma.product.update.mockResolvedValueOnce(sampleRow);

      await service.update(1, { name: 'Renamed' });

      const callArgs = mockPrisma.product.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(callArgs.data).not.toHaveProperty('images');
      expect(callArgs.data).toEqual({ name: 'Renamed' });
    });
  });

  describe('remove()', () => {
    it('deletes the product by id', async () => {
      mockPrisma.product.delete.mockResolvedValueOnce(sampleRow);

      await service.remove(1);

      expect(mockPrisma.product.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });
});
