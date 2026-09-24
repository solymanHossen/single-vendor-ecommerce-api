import { Test, type TestingModule } from '@nestjs/testing';
import { DiscountType, Prisma } from '@prisma/client';
import { StorefrontService } from './storefront.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { NAVIGATION_CACHE_KEY, NAVIGATION_CACHE_TTL_SECONDS } from './storefront.constants';

const mockPrisma = {
  category: { findMany: jest.fn() },
  product: { count: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
  orderItem: { groupBy: jest.fn() },
  review: { groupBy: jest.fn() },
  coupon: { findMany: jest.fn() },
  $queryRaw: jest.fn(),
};

const mockRedisClient = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
const mockRedis = { client: mockRedisClient };

function categoryRow(
  id: number,
  name: string,
  parentId: number | null,
  products: number,
): {
  id: number;
  name: string;
  slug: string;
  iconUrl: string | null;
  parentId: number | null;
  metaDesc: string | null;
  _count: { products: number };
} {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    iconUrl: null,
    parentId,
    metaDesc: `${name} description`,
    _count: { products },
  };
}

function productRow(
  id: number,
  discount: number | null,
): {
  id: number;
  name: string;
  slug: string;
  basePrice: Prisma.Decimal;
  discountPrice: Prisma.Decimal | null;
  metaDesc: string | null;
  category: { name: string; slug: string };
  images: Array<{ url: string }>;
} {
  return {
    id,
    name: `Product ${id}`,
    slug: `product-${id}`,
    basePrice: new Prisma.Decimal(1000),
    discountPrice: discount === null ? null : new Prisma.Decimal(discount),
    metaDesc: null,
    category: { name: 'Audio', slug: 'audio' },
    images: [{ url: `https://cdn.example.com/${id}.jpg` }],
  };
}

function arrangeDatabase(): void {
  mockPrisma.category.findMany.mockResolvedValue([
    categoryRow(1, 'Electronics', null, 0),
    categoryRow(2, 'Audio', 1, 3),
    categoryRow(3, 'Phones', 1, 5),
    categoryRow(4, 'Cameras', 1, 0),
    categoryRow(5, 'Fashion', null, 0),
    categoryRow(6, 'Footwear', 5, 2),
    categoryRow(7, 'Empty', null, 0),
  ]);
  mockPrisma.product.count.mockResolvedValueOnce(4).mockResolvedValueOnce(0);
  mockPrisma.orderItem.groupBy.mockResolvedValue([
    { productId: 11, _sum: { quantity: 9 } },
    { productId: 12, _sum: { quantity: 4 } },
  ]);
  mockPrisma.review.groupBy.mockResolvedValue([{ productId: 12, _avg: { rating: 4.8 } }]);
  mockPrisma.$queryRaw.mockResolvedValue([{ id: 11 }]);
  mockPrisma.product.findFirst.mockResolvedValue({ id: 13 });
  mockPrisma.coupon.findMany.mockResolvedValue([
    {
      code: 'EXHAUSTED',
      discountType: DiscountType.PERCENTAGE,
      discountValue: new Prisma.Decimal(25),
      minOrderAmount: null,
      maxDiscountAmount: null,
      validUntil: new Date('2026-10-01T00:00:00.000Z'),
      usageLimit: 10,
      usedCount: 10,
    },
    {
      code: 'FLASH20',
      discountType: DiscountType.PERCENTAGE,
      discountValue: new Prisma.Decimal(20),
      minOrderAmount: new Prisma.Decimal(2000),
      maxDiscountAmount: new Prisma.Decimal(2000),
      validUntil: new Date('2026-10-02T00:00:00.000Z'),
      usageLimit: 200,
      usedCount: 187,
    },
  ]);
  mockPrisma.product.findMany.mockResolvedValue([
    productRow(11, 700),
    productRow(12, null),
    productRow(13, 900),
  ]);
}

describe('StorefrontService', () => {
  let service: StorefrontService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorefrontService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<StorefrontService>(StorefrontService);
    jest.resetAllMocks();
  });

  describe('getNavigation()', () => {
    it('returns the cached payload without touching the database', async () => {
      const cached = {
        categories: [],
        collections: [],
        spotlight: null,
        trending: [],
        promotion: null,
        generatedAt: '2026-09-24T00:00:00.000Z',
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getNavigation();

      expect(result).toEqual(cached);
      expect(mockPrisma.category.findMany).not.toHaveBeenCalled();
    });

    it('builds a pruned, count-sorted category tree with rolled-up totals', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      arrangeDatabase();

      const { categories } = await service.getNavigation();

      expect(categories.map((category) => category.name)).toEqual(['Electronics', 'Fashion']);
      expect(categories[0]?.productCount).toBe(8);
      expect(categories[0]?.children.map((child) => child.name)).toEqual(['Phones', 'Audio']);
      expect(categories[0]?.description).toBe('Electronics description');
    });

    it('derives collections, spotlight, trending and the promotable coupon', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      arrangeDatabase();

      const navigation = await service.getNavigation();

      expect(navigation.collections.map((collection) => collection.key)).toEqual([
        'new-arrivals',
        'best-sellers',
        'top-rated',
      ]);
      expect(navigation.collections[0]?.previewImageUrl).toBe('https://cdn.example.com/13.jpg');
      expect(navigation.spotlight?.id).toBe(11);
      expect(navigation.spotlight?.discountPrice).toBe('700');
      expect(navigation.trending.map((product) => product.id)).toEqual([11, 12]);
      expect(navigation.promotion?.code).toBe('FLASH20');
      expect(navigation.promotion?.validUntil).toBe('2026-10-02T00:00:00.000Z');
    });

    it('batches every product card into a single lookup', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      arrangeDatabase();

      await service.getNavigation();

      expect(mockPrisma.product.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [11, 12, 13] } } }),
      );
    });

    it('writes the freshly built payload to the cache with a TTL', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      arrangeDatabase();

      await service.getNavigation();

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        NAVIGATION_CACHE_KEY,
        expect.any(String),
        'EX',
        NAVIGATION_CACHE_TTL_SECONDS,
      );
    });

    it('still serves navigation when Redis is unavailable', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('ECONNREFUSED'));
      mockRedisClient.set.mockRejectedValue(new Error('ECONNREFUSED'));
      arrangeDatabase();

      const navigation = await service.getNavigation();

      expect(navigation.categories).toHaveLength(2);
    });
  });

  describe('invalidateNavigation()', () => {
    it('deletes the cache key', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await service.invalidateNavigation();

      expect(mockRedisClient.del).toHaveBeenCalledWith(NAVIGATION_CACHE_KEY);
    });
  });
});
