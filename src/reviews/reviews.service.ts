import { ForbiddenException, Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { ReviewQueryDto } from './dto/query-review.dto';
import {
  PaginatedReviewsEntity,
  PaginationMetaEntity,
  ReviewEntity,
  ReviewerSummaryEntity,
  ReviewImageEntity,
  ReviewReplyEntity,
} from './entities/review.entity';

const REVIEW_SELECT = {
  id: true,
  userId: true,
  user: { select: { id: true, name: true } },
  productId: true,
  orderId: true,
  rating: true,
  comment: true,
  isApproved: true,
  images: { select: { id: true, imageUrl: true } },
  reply: { select: { id: true, adminId: true, replyText: true, createdAt: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ReviewSelect;

type ReviewRow = Prisma.ReviewGetPayload<{ select: typeof REVIEW_SELECT }>;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, dto: CreateReviewDto): Promise<ReviewEntity> {
    const orderId = await this.findVerifiedPurchaseOrderId(userId, dto.productId);

    // Re-submission for the same product hits the (userId, productId) unique
    // constraint (P2002 → 409); a nonexistent productId fails the FK
    // constraint (P2003 → 422) — both translated by PrismaClientExceptionFilter.
    const review = await this.prisma.review.create({
      data: {
        userId,
        productId: dto.productId,
        orderId,
        rating: dto.rating,
        comment: dto.comment,
        images: dto.images ? { create: dto.images.map((imageUrl) => ({ imageUrl })) } : undefined,
      },
      select: REVIEW_SELECT,
    });

    return this.toEntity(review);
  }

  async findAllForProduct(
    productId: number,
    query: ReviewQueryDto,
  ): Promise<PaginatedReviewsEntity> {
    // Confirms the product exists before listing — a bare `findMany` would
    // otherwise return an empty array for a non-existent product,
    // indistinguishable from "product exists but has no reviews yet".
    await this.prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { id: true } });

    return this.findAll({ ...query, productId, isApproved: true });
  }

  async findAllForAdmin(query: ReviewQueryDto): Promise<PaginatedReviewsEntity> {
    return this.findAll(query);
  }

  async approve(id: number): Promise<ReviewEntity> {
    const review = await this.prisma.review.update({
      where: { id },
      data: { isApproved: true },
      select: REVIEW_SELECT,
    });

    return this.toEntity(review);
  }

  async reply(adminId: number, reviewId: number, dto: ReplyReviewDto): Promise<ReviewEntity> {
    // reviewId is a plain scalar assignment, so a nonexistent review fails
    // the FK constraint (P2003 → 422); a review that already has a reply
    // hits ReviewReply's unique reviewId (P2002 → 409) — both translated by
    // PrismaClientExceptionFilter, no manual pre-checks needed.
    await this.prisma.reviewReply.create({
      data: { reviewId, adminId, replyText: dto.replyText },
      select: { id: true },
    });

    const review = await this.prisma.review.findUniqueOrThrow({
      where: { id: reviewId },
      select: REVIEW_SELECT,
    });

    return this.toEntity(review);
  }

  private async findAll(
    query: ReviewQueryDto & { productId?: number; isApproved?: boolean },
  ): Promise<PaginatedReviewsEntity> {
    const where: Prisma.ReviewWhereInput = {};

    if (query.productId !== undefined) {
      where.productId = query.productId;
    }
    if (query.userId !== undefined) {
      where.userId = query.userId;
    }
    if (query.isApproved !== undefined) {
      where.isApproved = query.isApproved;
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        select: REVIEW_SELECT,
        orderBy: { createdAt: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return new PaginatedReviewsEntity({
      items: rows.map((row) => this.toEntity(row)),
      meta: new PaginationMetaEntity({
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      }),
    });
  }

  private async findVerifiedPurchaseOrderId(
    userId: number,
    productId: number,
  ): Promise<number | null> {
    const order = await this.prisma.order.findFirst({
      where: { userId, status: OrderStatus.DELIVERED, items: { some: { productId } } },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!order) {
      throw new ForbiddenException(
        'You can only review products from an order that has been delivered to you.',
      );
    }

    return order.id;
  }

  private toEntity(review: ReviewRow): ReviewEntity {
    return new ReviewEntity({
      id: review.id,
      userId: review.userId,
      reviewer: new ReviewerSummaryEntity({ id: review.user.id, name: review.user.name }),
      productId: review.productId,
      orderId: review.orderId,
      rating: review.rating,
      comment: review.comment,
      isApproved: review.isApproved,
      images: review.images.map((image) => new ReviewImageEntity(image)),
      reply: review.reply ? new ReviewReplyEntity(review.reply) : null,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    });
  }
}
