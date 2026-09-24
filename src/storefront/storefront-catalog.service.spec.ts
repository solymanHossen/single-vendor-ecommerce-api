import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { StorefrontCatalogService } from './storefront-catalog.service';
import { PrismaService } from '../database/prisma.service';
import type { CatalogQueryDto } from './dto/catalog-query.dto';

const mockPrisma = {
  category: { findMany: jest.fn() },
  product: { findMany: jest.fn(), findFirst: jest.fn() },
  review: { groupBy: jest.fn() },
  orderItem: { aggregate: jest.fn() },
  $queryRaw: jest.fn(),
};

const CATEGORIES = [
  { id: 1, name: 'Electronics', slug: 'electronics', parentId: null, metaDesc: 'Tech' },
  { id: 2, name: 'Audio', slug: 'audio', parentId: 1, metaDesc: 'Sound' },
  { id: 3, name: 'Phones', slug: 'phones', parentId: 1, metaDesc: null },
  { id: 4, name: 'Fashion', slug: 'fashion', parentId: null, metaDesc: null },
  { id: 5, name: 'Shoes', slug: 'shoes', parentId: 4, metaDesc: null },
];

const baseQuery: CatalogQueryDto = { page: 1, limit: 24, sort: 'featured' };

function cardRow(id: number): Record<string, unknown> {
  return {
    id,
    name: `Product ${id}`,
    slug: `product-${id}`,
    basePrice: new Prisma.Decimal(1000),
    discountPrice: new Prisma.Decimal(800),
    stockQuantity: 5,
    createdAt: new Date(),
    category: { name: 'Audio', slug: 'audio' },
    images: [
      { url: `https://cdn.example.com/${id}-a.jpg` },
      { url: `https://cdn.example.com/${id}-b.jpg` },
    ],
    _count: { variants: 2 },
  };
}

/** Routes each raw query to a canned result based on its SQL text. */
function arrangeRawQueries(
  ranked: Array<{ id: number; avg_rating: number; review_count: number }>,
): void {
  mockPrisma.$queryRaw.mockImplementation((sql: Prisma.Sql) => {
    const text = sql.sql;
    if (text.includes('GROUP BY category_id')) {
      return Promise.resolve([
        { category_id: 2, total: 3 },
        { category_id: 3, total: 2 },
        { category_id: 5, total: 0 },
      ]);
    }
    if (text.includes('MIN(effective_price)')) {
      return Promise.resolve([{ min: '490.00', max: '9999.00' }]);
    }
    if (text.includes('COUNT(*)::int AS total FROM catalog')) {
      return Promise.resolve([{ total: 5 }]);
    }
    return Promise.resolve(ranked);
  });
}

describe('StorefrontCatalogService', () => {
  let service: StorefrontCatalogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StorefrontCatalogService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<StorefrontCatalogService>(StorefrontCatalogService);
    jest.resetAllMocks();
    mockPrisma.category.findMany.mockResolvedValue(CATEGORIES);
  });

  describe('listProducts()', () => {
    it('rejects an unknown category slug with 404', async () => {
      await expect(
        service.listProducts({ ...baseQuery, category: 'missing' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('filters a parent category by its whole subtree', async () => {
      arrangeRawQueries([]);

      await service.listProducts({ ...baseQuery, category: 'electronics' });

      const rankingSql = (mockPrisma.$queryRaw.mock.calls[0]?.[0] as Prisma.Sql).values;
      expect(rankingSql).toEqual(expect.arrayContaining([1, 2, 3]));
    });

    it('returns cards in ranked order with rating aggregates and hover image', async () => {
      arrangeRawQueries([
        { id: 7, avg_rating: 4.666, review_count: 3 },
        { id: 3, avg_rating: 0, review_count: 0 },
      ]);
      mockPrisma.product.findMany.mockResolvedValue([cardRow(3), cardRow(7)]);

      const page = await service.listProducts({ ...baseQuery, category: 'audio' });

      expect(page.items.map((item) => item.id)).toEqual([7, 3]);
      expect(page.items[0]?.ratingAverage).toBe(4.7);
      expect(page.items[0]?.hoverImageUrl).toBe('https://cdn.example.com/7-b.jpg');
      expect(page.items[0]?.discountPrice).toBe('800');
      expect(page.category?.parent?.slug).toBe('electronics');
      expect(page.meta).toEqual({ page: 1, limit: 24, total: 5, totalPages: 1 });
    });

    it('builds a pruned facet tree with rolled-up counts and a price range', async () => {
      arrangeRawQueries([]);

      const page = await service.listProducts(baseQuery);

      expect(page.facets.categories).toHaveLength(1);
      expect(page.facets.categories[0]?.productCount).toBe(5);
      expect(page.facets.categories[0]?.children.map((child) => child.slug)).toEqual([
        'audio',
        'phones',
      ]);
      expect(page.facets.priceRange).toEqual({ min: '490.00', max: '9999.00' });
    });
  });

  describe('getProduct()', () => {
    it.each(['0', '99999999999', 'Bad Slug!', ''])(
      'treats "%s" as not found without querying',
      async (input) => {
        await expect(service.getProduct(input)).rejects.toBeInstanceOf(NotFoundException);
        expect(mockPrisma.product.findFirst).not.toHaveBeenCalled();
      },
    );

    it('only ever looks up published products', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);

      await expect(service.getProduct('iphone-15-pro')).rejects.toBeInstanceOf(NotFoundException);
      expect(mockPrisma.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'iphone-15-pro', isPublished: true } }),
      );
    });

    it('groups variant options by attribute and summarises ratings', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 1,
        name: 'Phone',
        slug: 'phone',
        description: 'A phone',
        basePrice: new Prisma.Decimal(1000),
        discountPrice: null,
        sku: 'PHN-001',
        stockQuantity: 4,
        metaTitle: null,
        metaDesc: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        category: {
          id: 3,
          name: 'Phones',
          slug: 'phones',
          metaDesc: null,
          parent: { id: 1, name: 'Electronics', slug: 'electronics' },
        },
        images: [{ id: 1, url: 'https://cdn.example.com/1.jpg', isThumbnail: true }],
        variants: [
          {
            id: 10,
            sku: 'PHN-001-BLK-128',
            price: new Prisma.Decimal(1000),
            stockQuantity: 2,
            imageUrl: null,
            options: [
              {
                attributeOption: { id: 21, value: '128GB', attribute: { id: 2, name: 'Storage' } },
              },
              { attributeOption: { id: 11, value: 'Black', attribute: { id: 1, name: 'Color' } } },
            ],
          },
          {
            id: 11,
            sku: 'PHN-001-WHT-128',
            price: new Prisma.Decimal(1000),
            stockQuantity: 0,
            imageUrl: null,
            options: [
              {
                attributeOption: { id: 21, value: '128GB', attribute: { id: 2, name: 'Storage' } },
              },
              { attributeOption: { id: 12, value: 'White', attribute: { id: 1, name: 'Color' } } },
            ],
          },
        ],
      });
      mockPrisma.review.groupBy.mockResolvedValue([
        { rating: 5, _count: { _all: 3 } },
        { rating: 2, _count: { _all: 1 } },
      ]);
      mockPrisma.orderItem.aggregate.mockResolvedValue({ _sum: { quantity: 7 } });
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const product = await service.getProduct('1');

      expect(product.optionGroups).toEqual([
        {
          attributeId: 1,
          name: 'Color',
          values: [
            { id: 11, value: 'Black' },
            { id: 12, value: 'White' },
          ],
        },
        { attributeId: 2, name: 'Storage', values: [{ id: 21, value: '128GB' }] },
      ]);
      expect(product.variants[0]?.optionIds).toEqual([21, 11]);
      expect(product.rating).toEqual({
        average: 4.3,
        count: 4,
        distribution: { '1': 0, '2': 1, '3': 0, '4': 0, '5': 3 },
      });
      expect(product.recentlySold).toBe(7);
      expect(product.category.parent?.slug).toBe('electronics');
    });
  });
});
