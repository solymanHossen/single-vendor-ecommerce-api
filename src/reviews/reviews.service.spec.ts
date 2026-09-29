import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../database/prisma.service';
import { displayName } from './reviews.constants';

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  userId: 7,
  productId: 3,
  orderId: 11,
  rating: 5,
  title: 'Love it',
  comment: 'Great sound.',
  variantLabel: 'Black',
  isApproved: true,
  hiddenAt: null,
  helpfulCount: 2,
  editedAt: null,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  user: { id: 7, name: 'Nusrat Jahan', email: 'n@example.com', avatarUrl: null },
  images: [{ id: 9, imageUrl: 'https://cdn/reviews/a.jpg' }],
  reply: null,
  ...overrides,
});

const mockPrisma = {
  product: { findUnique: jest.fn() },
  review: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  reviewVote: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
  reviewReply: { upsert: jest.fn(), deleteMany: jest.fn() },
  orderItem: { findFirst: jest.fn() },
  order: { count: jest.fn() },
  $transaction: jest.fn(),
};

describe('ReviewsService', () => {
  let service: ReviewsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReviewsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(ReviewsService);
    jest.resetAllMocks();
    mockPrisma.product.findUnique.mockResolvedValue({ id: 3 });
    mockPrisma.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
  });

  it('shows first name and last initial publicly', () => {
    expect(displayName('Nusrat Jahan Talukder')).toBe('Nusrat T.');
    expect(displayName('Rafi')).toBe('Rafi');
    expect(displayName(null)).toBe('Customer');
  });

  describe('findAllForProduct()', () => {
    it('lists published reviews with filters and a rating summary', async () => {
      mockPrisma.review.findMany.mockResolvedValueOnce([row()]);
      mockPrisma.review.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
      mockPrisma.review.groupBy.mockResolvedValueOnce([
        { rating: 5, _count: { _all: 3 } },
        { rating: 2, _count: { _all: 1 } },
      ]);

      const page = await service.findAllForProduct(3, {
        page: 1,
        limit: 5,
        sort: 'helpful',
        rating: 5,
        withPhotos: true,
      });

      const args = mockPrisma.review.findMany.mock.calls[0][0] as {
        where: unknown;
        orderBy: unknown;
      };
      expect(args.where).toEqual({
        productId: 3,
        isApproved: true,
        rating: 5,
        images: { some: {} },
      });
      expect(args.orderBy).toEqual([
        { helpfulCount: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ]);
      expect(page.summary).toMatchObject({ average: 4.3, count: 4, recommendRate: 0.75 });
      expect(page.items[0]).toMatchObject({
        verified: true,
        reviewer: { name: 'Nusrat J.' },
        edited: false,
      });
      // Never leak the email publicly.
      expect(JSON.stringify(page.items[0])).not.toContain('n@example.com');
    });

    it('404s for an unknown product', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.findAllForProduct(99, { page: 1, limit: 5, sort: 'recent' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('myStatus()', () => {
    beforeEach(() => mockPrisma.reviewVote.findMany.mockResolvedValue([{ reviewId: 4 }]));

    it('reports an existing review', async () => {
      mockPrisma.review.findUnique.mockResolvedValueOnce(row());
      const status = await service.myStatus(7, 3);
      expect(status).toMatchObject({
        eligible: false,
        blocker: 'ALREADY_REVIEWED',
        votedReviewIds: [4],
      });
      expect(status.review?.status).toBe('PUBLISHED');
    });

    it('is eligible after delivery', async () => {
      mockPrisma.review.findUnique.mockResolvedValueOnce(null);
      mockPrisma.orderItem.findFirst.mockResolvedValueOnce({ orderId: 11, variant: null });
      await expect(service.myStatus(7, 3)).resolves.toMatchObject({
        eligible: true,
        blocker: null,
      });
    });

    it('explains an order that is still on its way', async () => {
      mockPrisma.review.findUnique.mockResolvedValueOnce(null);
      mockPrisma.orderItem.findFirst.mockResolvedValueOnce(null);
      mockPrisma.order.count.mockResolvedValueOnce(1);
      await expect(service.myStatus(7, 3)).resolves.toMatchObject({ blocker: 'NOT_DELIVERED' });
    });
  });

  describe('create()', () => {
    const dto = { productId: 3, rating: 4, title: 'Nice', comment: '' };

    it('publishes a verified review with what was bought', async () => {
      mockPrisma.review.findUnique.mockResolvedValueOnce(null);
      mockPrisma.orderItem.findFirst.mockResolvedValueOnce({
        orderId: 11,
        variant: {
          options: [
            { attributeOption: { value: 'Black' } },
            { attributeOption: { value: '128GB' } },
          ],
        },
      });
      mockPrisma.review.create.mockResolvedValueOnce(row());

      await service.create(7, dto);

      const args = mockPrisma.review.create.mock.calls[0][0] as { data: Record<string, unknown> };
      expect(args.data).toMatchObject({
        orderId: 11,
        variantLabel: 'Black · 128GB',
        isApproved: true,
        comment: null,
      });
    });

    it('allows only one review per product', async () => {
      mockPrisma.review.findUnique.mockResolvedValueOnce({ id: 1 });
      await expect(service.create(7, dto)).rejects.toThrow(ConflictException);
    });

    it('requires a delivered order', async () => {
      mockPrisma.review.findUnique.mockResolvedValueOnce(null);
      mockPrisma.orderItem.findFirst.mockResolvedValueOnce(null);
      await expect(service.create(7, dto)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.orderItem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 3, order: { userId: 7, status: 'DELIVERED' } },
        }),
      );
    });
  });

  describe('update() / remove()', () => {
    it('stamps editedAt and replaces photos', async () => {
      mockPrisma.review.findFirst.mockResolvedValueOnce({ id: 1 });
      mockPrisma.review.update.mockResolvedValueOnce(row());
      await service.update(7, 1, { rating: 3, images: ['https://cdn/reviews/b.jpg'] });
      const args = mockPrisma.review.update.mock.calls[0][0] as { data: Record<string, unknown> };
      expect(args.data).toMatchObject({
        editedAt: expect.any(Date),
        rating: 3,
        images: { deleteMany: {}, create: [{ imageUrl: 'https://cdn/reviews/b.jpg' }] },
      });
    });

    it('refuses someone else’s review', async () => {
      mockPrisma.review.findFirst.mockResolvedValueOnce(null);
      await expect(service.remove(8, 1)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.review.delete).not.toHaveBeenCalled();
    });
  });

  describe('toggleHelpful()', () => {
    it('adds a vote', async () => {
      mockPrisma.review.findFirst.mockResolvedValueOnce({ userId: 8 });
      mockPrisma.reviewVote.findUnique.mockResolvedValueOnce(null);
      mockPrisma.reviewVote.create.mockResolvedValueOnce({});
      mockPrisma.review.update.mockResolvedValueOnce({ helpfulCount: 3 });
      await expect(service.toggleHelpful(7, 1)).resolves.toEqual({
        helpful: true,
        helpfulCount: 3,
      });
    });

    it('removes an existing vote', async () => {
      mockPrisma.review.findFirst.mockResolvedValueOnce({ userId: 8 });
      mockPrisma.reviewVote.findUnique.mockResolvedValueOnce({ reviewId: 1 });
      mockPrisma.reviewVote.delete.mockResolvedValueOnce({});
      mockPrisma.review.update.mockResolvedValueOnce({ helpfulCount: 1 });
      await expect(service.toggleHelpful(7, 1)).resolves.toEqual({
        helpful: false,
        helpfulCount: 1,
      });
    });

    it('won’t let authors vote for themselves', async () => {
      mockPrisma.review.findFirst.mockResolvedValueOnce({ userId: 7 });
      await expect(service.toggleHelpful(7, 1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('moderation', () => {
    const adminRow = () => ({
      ...row(),
      product: { id: 3, name: 'Headphones', images: [{ url: 'x' }] },
    });

    it('hides a review with a timestamp and publishes it again', async () => {
      mockPrisma.review.update.mockResolvedValue(adminRow());
      await service.moderate(1, { status: 'HIDDEN' });
      await service.moderate(1, { status: 'PUBLISHED' });
      const calls = mockPrisma.review.update.mock.calls as Array<[{ data: unknown }]>;
      expect(calls[0]![0].data).toEqual({ isApproved: false, hiddenAt: expect.any(Date) });
      expect(calls[1]![0].data).toEqual({ isApproved: true, hiddenAt: null });
    });

    it('shows staff the full name and counts per status', async () => {
      mockPrisma.review.findMany.mockResolvedValueOnce([adminRow()]);
      mockPrisma.review.count.mockResolvedValue(1);
      const page = await service.findAllForAdmin({ page: 1, limit: 20, status: 'PENDING' });
      expect(page.items[0]?.reviewer.name).toBe('Nusrat Jahan');
      expect(page.counts).toEqual({ PENDING: 1, PUBLISHED: 1, HIDDEN: 1, ALL: 1 });
      const args = mockPrisma.review.findMany.mock.calls[0][0] as { where: unknown };
      expect(args.where).toEqual({ isApproved: false, hiddenAt: null });
    });

    it('replaces an existing reply', async () => {
      mockPrisma.review.findUniqueOrThrow
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce(adminRow());
      await service.reply(2, 1, { replyText: 'Thank you!' });
      expect(mockPrisma.reviewReply.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { reviewId: 1 },
          update: expect.objectContaining({ replyText: 'Thank you!' }),
        }),
      );
    });
  });

  it('keeps edits within a minute from reading as "edited"', async () => {
    mockPrisma.review.findMany.mockResolvedValueOnce([
      row({ editedAt: new Date('2026-09-01T00:00:30Z') }),
      row({ id: 2, editedAt: new Date('2026-09-02T00:00:00Z') }),
    ]);
    mockPrisma.review.count.mockResolvedValue(2);
    mockPrisma.review.groupBy.mockResolvedValueOnce([]);
    const page = await service.findAllForProduct(3, { page: 1, limit: 5, sort: 'recent' });
    expect(page.items.map((item) => item.edited)).toEqual([false, true]);
    expect(Prisma).toBeDefined();
  });
});
