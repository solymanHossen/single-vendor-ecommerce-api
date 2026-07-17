import { ForbiddenException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../database/prisma.service';

const mockPrisma = {
  order: { findFirst: jest.fn() },
  product: { findUniqueOrThrow: jest.fn() },
  review: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  reviewReply: { create: jest.fn() },
  $transaction: jest.fn(),
};

const sampleRow = {
  id: 1,
  userId: 7,
  user: { id: 7, name: 'Jane Doe' },
  productId: 101,
  orderId: 301,
  rating: 5,
  comment: 'Great!',
  isApproved: false,
  images: [],
  reply: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('ReviewsService', () => {
  let service: ReviewsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReviewsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('throws ForbiddenException when no delivered order contains the product', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(null);

      await expect(service.create(7, { productId: 101, rating: 5 })).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.review.create).not.toHaveBeenCalled();
    });

    it('creates the review linked to the verified purchase order', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce({ id: 301 });
      mockPrisma.review.create.mockResolvedValueOnce(sampleRow);

      const result = await service.create(7, { productId: 101, rating: 5, comment: 'Great!' });

      expect(mockPrisma.review.create).toHaveBeenCalledWith({
        data: {
          userId: 7,
          productId: 101,
          orderId: 301,
          rating: 5,
          comment: 'Great!',
          images: undefined,
        },
        select: expect.any(Object),
      });
      expect(result.reviewer.name).toBe('Jane Doe');
    });

    it('creates nested review images when provided', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce({ id: 301 });
      mockPrisma.review.create.mockResolvedValueOnce(sampleRow);

      await service.create(7, {
        productId: 101,
        rating: 5,
        images: ['https://cdn.example.com/1.jpg'],
      });

      const callArgs = mockPrisma.review.create.mock.calls[0][0] as {
        data: { images?: { create: unknown } };
      };
      expect(callArgs.data.images).toEqual({
        create: [{ imageUrl: 'https://cdn.example.com/1.jpg' }],
      });
    });
  });

  describe('findAllForProduct()', () => {
    it('verifies the product exists, then lists only approved reviews for it', async () => {
      mockPrisma.product.findUniqueOrThrow.mockResolvedValueOnce({ id: 101 });
      mockPrisma.$transaction.mockResolvedValueOnce([[sampleRow], 1]);

      await service.findAllForProduct(101, { page: 1, limit: 20, sortOrder: 'desc' });

      expect(mockPrisma.product.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 101 } }),
      );
      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { productId: 101, isApproved: true } }),
      );
    });
  });

  describe('findAllForAdmin()', () => {
    it('builds a where clause from productId/userId/isApproved filters', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[], 0]);

      await service.findAllForAdmin({
        page: 1,
        limit: 20,
        sortOrder: 'desc',
        productId: 101,
        userId: 7,
        isApproved: false,
      });

      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { productId: 101, userId: 7, isApproved: false } }),
      );
    });
  });

  describe('approve()', () => {
    it('sets isApproved to true', async () => {
      mockPrisma.review.update.mockResolvedValueOnce({ ...sampleRow, isApproved: true });

      const result = await service.approve(1);

      expect(mockPrisma.review.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isApproved: true },
        select: expect.any(Object),
      });
      expect(result.isApproved).toBe(true);
    });
  });

  describe('reply()', () => {
    it('creates a reply and returns the review re-fetched with it attached', async () => {
      mockPrisma.reviewReply.create.mockResolvedValueOnce({ id: 1 });
      mockPrisma.review.findUniqueOrThrow.mockResolvedValueOnce({
        ...sampleRow,
        reply: { id: 1, adminId: 3, replyText: 'Thanks!', createdAt: new Date() },
      });

      const result = await service.reply(3, 1, { replyText: 'Thanks!' });

      expect(mockPrisma.reviewReply.create).toHaveBeenCalledWith({
        data: { reviewId: 1, adminId: 3, replyText: 'Thanks!' },
        select: { id: true },
      });
      expect(result.reply?.replyText).toBe('Thanks!');
    });
  });
});
