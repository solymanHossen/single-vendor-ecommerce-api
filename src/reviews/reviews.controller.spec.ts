import { Test, type TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import {
  PaginatedReviewsEntity,
  ReviewEntity,
  ReviewerSummaryEntity,
} from './entities/review.entity';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockReviewsService = {
  create: jest.fn(),
  findAllForProduct: jest.fn(),
  findAllForAdmin: jest.fn(),
  approve: jest.fn(),
  reply: jest.fn(),
};

const currentUser: AuthUser = { id: 7, email: 'a@b.com', role: Role.USER, isActive: true };

const sampleReview = new ReviewEntity({
  id: 1,
  userId: 7,
  reviewer: new ReviewerSummaryEntity({ id: 7, name: 'Jane Doe' }),
  productId: 101,
  orderId: 301,
  rating: 5,
  comment: 'Great!',
  isApproved: false,
  images: [],
  reply: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('ReviewsController', () => {
  let controller: ReviewsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [{ provide: ReviewsService, useValue: mockReviewsService }],
    }).compile();

    controller = module.get<ReviewsController>(ReviewsController);
    jest.clearAllMocks();
  });

  describe('findAllForProduct()', () => {
    it('delegates to the service with productId and query', async () => {
      const paginated = new PaginatedReviewsEntity({
        items: [sampleReview],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
      mockReviewsService.findAllForProduct.mockResolvedValueOnce(paginated);
      const query = { page: 1, limit: 20, sortOrder: 'desc' as const };

      const result = await controller.findAllForProduct(101, query);

      expect(mockReviewsService.findAllForProduct).toHaveBeenCalledWith(101, query);
      expect(result).toEqual({ message: 'Reviews retrieved successfully', data: paginated });
    });
  });

  describe('create()', () => {
    it("delegates to the service with the current user's id and dto", async () => {
      mockReviewsService.create.mockResolvedValueOnce(sampleReview);
      const dto = { productId: 101, rating: 5, comment: 'Great!' };

      const result = await controller.create(currentUser, dto);

      expect(mockReviewsService.create).toHaveBeenCalledWith(7, dto);
      expect(result).toEqual({ message: 'Review submitted successfully', data: sampleReview });
    });
  });

  describe('findAllForAdmin()', () => {
    it('delegates to the service with the query', async () => {
      const paginated = new PaginatedReviewsEntity({
        items: [sampleReview],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
      mockReviewsService.findAllForAdmin.mockResolvedValueOnce(paginated);
      const query = { page: 1, limit: 20, sortOrder: 'desc' as const };

      const result = await controller.findAllForAdmin(query);

      expect(mockReviewsService.findAllForAdmin).toHaveBeenCalledWith(query);
      expect(result).toEqual({ message: 'Reviews retrieved successfully', data: paginated });
    });
  });

  describe('approve()', () => {
    it('delegates to the service and wraps the result', async () => {
      mockReviewsService.approve.mockResolvedValueOnce({ ...sampleReview, isApproved: true });

      const result = await controller.approve(1);

      expect(mockReviewsService.approve).toHaveBeenCalledWith(1);
      expect(result).toEqual({
        message: 'Review approved successfully',
        data: { ...sampleReview, isApproved: true },
      });
    });
  });

  describe('reply()', () => {
    it("delegates to the service with the current admin's id, review id, and dto", async () => {
      mockReviewsService.reply.mockResolvedValueOnce(sampleReview);

      const result = await controller.reply(currentUser, 1, { replyText: 'Thanks!' });

      expect(mockReviewsService.reply).toHaveBeenCalledWith(7, 1, { replyText: 'Thanks!' });
      expect(result).toEqual({ message: 'Reply added successfully', data: sampleReview });
    });
  });
});
