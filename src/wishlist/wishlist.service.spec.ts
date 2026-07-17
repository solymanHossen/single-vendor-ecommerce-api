import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { WishlistService } from './wishlist.service';
import { PrismaService } from '../database/prisma.service';

const mockPrisma = {
  wishlist: {
    findMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const sampleRow = {
  id: 5,
  productId: 101,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  product: {
    id: 101,
    name: 'iPhone 17 Pro',
    slug: 'iphone-17-pro',
    basePrice: 999,
    discountPrice: null,
    images: [{ url: 'https://cdn.example.com/1.jpg' }],
  },
};

describe('WishlistService', () => {
  let service: WishlistService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WishlistService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<WishlistService>(WishlistService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it("lists the user's wishlist items with embedded product summaries", async () => {
      mockPrisma.wishlist.findMany.mockResolvedValueOnce([sampleRow]);

      const result = await service.findAll(10);

      expect(mockPrisma.wishlist.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 10 }, orderBy: { createdAt: 'desc' } }),
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.product.name).toBe('iPhone 17 Pro');
      expect(result[0]?.product.imageUrl).toBe('https://cdn.example.com/1.jpg');
    });

    it('uses discountPrice over basePrice for the embedded product summary', async () => {
      mockPrisma.wishlist.findMany.mockResolvedValueOnce([
        { ...sampleRow, product: { ...sampleRow.product, discountPrice: 799 } },
      ]);

      const result = await service.findAll(10);

      expect(result[0]?.product.price).toBe(799);
    });
  });

  describe('create()', () => {
    it('creates a wishlist entry scoped to the user', async () => {
      mockPrisma.wishlist.create.mockResolvedValueOnce(sampleRow);

      const result = await service.create(10, { productId: 101 });

      expect(mockPrisma.wishlist.create).toHaveBeenCalledWith({
        data: { userId: 10, productId: 101 },
        select: expect.any(Object),
      });
      expect(result.productId).toBe(101);
    });
  });

  describe('remove()', () => {
    it('deletes the wishlist entry when owned by the user', async () => {
      mockPrisma.wishlist.deleteMany.mockResolvedValueOnce({ count: 1 });

      await service.remove(10, 101);

      expect(mockPrisma.wishlist.deleteMany).toHaveBeenCalledWith({
        where: { userId: 10, productId: 101 },
      });
    });

    it('throws NotFoundException when the product is not in the wishlist', async () => {
      mockPrisma.wishlist.deleteMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.remove(10, 999)).rejects.toThrow(NotFoundException);
    });
  });
});
