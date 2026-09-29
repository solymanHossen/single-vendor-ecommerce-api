import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { variantLabel } from '../carts/cart-pricing';
import type { CreateReviewDto, UpdateReviewDto } from './dto/create-review.dto';
import type { ReplyReviewDto } from './dto/reply-review.dto';
import type {
  AdminReviewQueryDto,
  ModerateReviewDto,
  ReviewQueryDto,
} from './dto/query-review.dto';
import { REVIEW_STATUSES, displayName, type ReviewStatus } from './reviews.constants';
import {
  AdminReviewEntity,
  MyReviewStatusEntity,
  OwnReviewEntity,
  PaginatedAdminReviewsEntity,
  PaginationMetaEntity,
  ProductReviewsEntity,
  PublicReviewEntity,
  ReviewImageEntity,
  ReviewReplyEntity,
  ReviewSummaryEntity,
  ReviewerEntity,
} from './entities/review.entity';

const REVIEW_SELECT = {
  id: true,
  userId: true,
  productId: true,
  orderId: true,
  rating: true,
  title: true,
  comment: true,
  variantLabel: true,
  isApproved: true,
  hiddenAt: true,
  helpfulCount: true,
  editedAt: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true, avatarUrl: true } },
  images: { select: { id: true, imageUrl: true }, orderBy: { id: 'asc' } },
  reply: { select: { replyText: true, createdAt: true } },
} satisfies Prisma.ReviewSelect;

const ADMIN_SELECT = {
  ...REVIEW_SELECT,
  product: {
    select: {
      id: true,
      name: true,
      images: {
        select: { url: true },
        orderBy: [{ isThumbnail: 'desc' }, { id: 'asc' }],
        take: 1,
      },
    },
  },
} satisfies Prisma.ReviewSelect;

type ReviewRow = Prisma.ReviewGetPayload<{ select: typeof REVIEW_SELECT }>;
type AdminReviewRow = Prisma.ReviewGetPayload<{ select: typeof ADMIN_SELECT }>;

const PUBLISHED = { isApproved: true } satisfies Prisma.ReviewWhereInput;

const STATUS_WHERE: Record<ReviewStatus | 'ALL', Prisma.ReviewWhereInput> = {
  PENDING: { isApproved: false, hiddenAt: null },
  PUBLISHED,
  HIDDEN: { isApproved: false, hiddenAt: { not: null } },
  ALL: {},
};

/** A minute's grace so fixing a typo right away doesn't read as "edited". */
const EDIT_GRACE_MS = 60_000;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Product page ──────────────────────────────────────────────────────────

  async findAllForProduct(productId: number, query: ReviewQueryDto): Promise<ProductReviewsEntity> {
    await this.assertProduct(productId);

    const where: Prisma.ReviewWhereInput = {
      productId,
      ...PUBLISHED,
      ...(query.rating && { rating: query.rating }),
      ...(query.withPhotos && { images: { some: {} } }),
    };
    const orderBy: Prisma.ReviewOrderByWithRelationInput[] = {
      recent: [{ createdAt: 'desc' as const }],
      helpful: [{ helpfulCount: 'desc' as const }, { createdAt: 'desc' as const }],
      highest: [{ rating: 'desc' as const }, { createdAt: 'desc' as const }],
      lowest: [{ rating: 'asc' as const }, { createdAt: 'desc' as const }],
    }[query.sort];

    const [rows, total, summary] = await Promise.all([
      this.prisma.review.findMany({
        where,
        select: REVIEW_SELECT,
        orderBy: [...orderBy, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.review.count({ where }),
      this.summary(productId),
    ]);

    return new ProductReviewsEntity({
      items: rows.map((row) => this.toPublic(row)),
      meta: this.meta(query.page, query.limit, total),
      summary,
    });
  }

  /** Can the viewer review this product, and their own review if any. */
  async myStatus(userId: number, productId: number): Promise<MyReviewStatusEntity> {
    await this.assertProduct(productId);

    const [own, votes] = await Promise.all([
      this.prisma.review.findUnique({
        where: { userId_productId: { userId, productId } },
        select: REVIEW_SELECT,
      }),
      this.prisma.reviewVote.findMany({
        where: { userId, review: { productId } },
        select: { reviewId: true },
      }),
    ]);
    const votedReviewIds = votes.map((vote) => vote.reviewId);

    if (own) {
      return new MyReviewStatusEntity({
        eligible: false,
        blocker: 'ALREADY_REVIEWED',
        review: this.toOwn(own),
        votedReviewIds,
      });
    }

    const delivered = await this.deliveredPurchase(userId, productId);
    if (delivered) {
      return new MyReviewStatusEntity({
        eligible: true,
        blocker: null,
        review: null,
        votedReviewIds,
      });
    }

    const onTheWay = await this.prisma.order.count({
      where: {
        userId,
        status: { in: [OrderStatus.PENDING, OrderStatus.PROCESSING, OrderStatus.SHIPPED] },
        items: { some: { productId } },
      },
    });
    return new MyReviewStatusEntity({
      eligible: false,
      blocker: onTheWay > 0 ? 'NOT_DELIVERED' : 'NOT_PURCHASED',
      review: null,
      votedReviewIds,
    });
  }

  // ── Author ────────────────────────────────────────────────────────────────

  /** One review per product, only from a delivered order; published straight away. */
  async create(userId: number, dto: CreateReviewDto): Promise<OwnReviewEntity> {
    await this.assertProduct(dto.productId);

    const existing = await this.prisma.review.findUnique({
      where: { userId_productId: { userId, productId: dto.productId } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'You’ve already reviewed this product — you can edit your review instead.',
      );
    }

    const purchase = await this.deliveredPurchase(userId, dto.productId);
    if (!purchase) {
      throw new ForbiddenException(
        'You can review this product once an order containing it has been delivered to you.',
      );
    }

    const review = await this.prisma.review.create({
      data: {
        userId,
        productId: dto.productId,
        orderId: purchase.orderId,
        variantLabel: purchase.variantLabel,
        rating: dto.rating,
        title: dto.title || null,
        comment: dto.comment || null,
        // Verified buyers only, so it goes live; moderators can still hide it.
        isApproved: true,
        images: dto.images?.length
          ? { create: dto.images.map((imageUrl) => ({ imageUrl })) }
          : undefined,
      },
      select: REVIEW_SELECT,
    });

    return this.toOwn(review);
  }

  async update(userId: number, id: number, dto: UpdateReviewDto): Promise<OwnReviewEntity> {
    await this.own(userId, id);

    const review = await this.prisma.review.update({
      where: { id },
      data: {
        editedAt: new Date(),
        ...(dto.rating !== undefined && { rating: dto.rating }),
        ...(dto.title !== undefined && { title: dto.title || null }),
        ...(dto.comment !== undefined && { comment: dto.comment || null }),
        ...(dto.images !== undefined && {
          images: { deleteMany: {}, create: dto.images.map((imageUrl) => ({ imageUrl })) },
        }),
      },
      select: REVIEW_SELECT,
    });

    return this.toOwn(review);
  }

  async remove(userId: number, id: number): Promise<void> {
    await this.own(userId, id);
    await this.prisma.review.delete({ where: { id } });
  }

  /** The viewer's reviews — lets the order page show "Rated ★4" per item. */
  async mine(userId: number): Promise<OwnReviewEntity[]> {
    const rows = await this.prisma.review.findMany({
      where: { userId },
      select: REVIEW_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toOwn(row));
  }

  /** Toggles "helpful". The vote row's primary key makes double votes impossible. */
  async toggleHelpful(
    userId: number,
    reviewId: number,
  ): Promise<{ helpful: boolean; helpfulCount: number }> {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, ...PUBLISHED },
      select: { userId: true },
    });
    if (!review) throw new NotFoundException('Review does not exist.');
    if (review.userId === userId) {
      throw new BadRequestException('You can’t vote on your own review.');
    }

    const key = { userId_reviewId: { userId, reviewId } };
    const voted = await this.prisma.reviewVote.findUnique({
      where: key,
      select: { reviewId: true },
    });

    const [, updated] = await this.prisma.$transaction(
      voted
        ? [
            this.prisma.reviewVote.delete({ where: key }),
            this.prisma.review.update({
              where: { id: reviewId },
              data: { helpfulCount: { decrement: 1 } },
              select: { helpfulCount: true },
            }),
          ]
        : [
            this.prisma.reviewVote.create({ data: { userId, reviewId } }),
            this.prisma.review.update({
              where: { id: reviewId },
              data: { helpfulCount: { increment: 1 } },
              select: { helpfulCount: true },
            }),
          ],
    );
    return { helpful: !voted, helpfulCount: Math.max(0, updated.helpfulCount) };
  }

  // ── Moderation ────────────────────────────────────────────────────────────

  async findAllForAdmin(query: AdminReviewQueryDto): Promise<PaginatedAdminReviewsEntity> {
    const where: Prisma.ReviewWhereInput = {
      ...STATUS_WHERE[query.status],
      ...(query.rating && { rating: query.rating }),
    };
    if (query.search) {
      const contains = { contains: query.search, mode: 'insensitive' as const };
      where.OR = [
        { product: { name: contains } },
        { user: { name: contains } },
        { user: { email: contains } },
        { comment: contains },
        { title: contains },
      ];
    }

    const statuses = [...REVIEW_STATUSES, 'ALL'] as const;
    const [rows, total, counts] = await Promise.all([
      this.prisma.review.findMany({
        where,
        select: ADMIN_SELECT,
        // Pending first on the "all" view; newest first within.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.review.count({ where }),
      this.prisma.$transaction(
        statuses.map((status) => this.prisma.review.count({ where: STATUS_WHERE[status] })),
      ),
    ]);

    return new PaginatedAdminReviewsEntity({
      items: rows.map((row) => this.toAdmin(row)),
      meta: this.meta(query.page, query.limit, total),
      counts: Object.fromEntries(statuses.map((status, i) => [status, counts[i]])) as Record<
        ReviewStatus | 'ALL',
        number
      >,
    });
  }

  async moderate(id: number, dto: ModerateReviewDto): Promise<AdminReviewEntity> {
    const review = await this.prisma.review.update({
      where: { id },
      data:
        dto.status === 'PUBLISHED'
          ? { isApproved: true, hiddenAt: null }
          : { isApproved: false, hiddenAt: new Date() },
      select: ADMIN_SELECT,
    });
    return this.toAdmin(review);
  }

  /** One public response per review; replying again replaces it. */
  async reply(adminId: number, reviewId: number, dto: ReplyReviewDto): Promise<AdminReviewEntity> {
    await this.prisma.review.findUniqueOrThrow({ where: { id: reviewId }, select: { id: true } });
    await this.prisma.reviewReply.upsert({
      where: { reviewId },
      create: { reviewId, adminId, replyText: dto.replyText },
      update: { adminId, replyText: dto.replyText, createdAt: new Date() },
      select: { id: true },
    });
    return this.toAdmin(
      await this.prisma.review.findUniqueOrThrow({ where: { id: reviewId }, select: ADMIN_SELECT }),
    );
  }

  async removeReply(reviewId: number): Promise<AdminReviewEntity> {
    await this.prisma.reviewReply.deleteMany({ where: { reviewId } });
    return this.toAdmin(
      await this.prisma.review.findUniqueOrThrow({ where: { id: reviewId }, select: ADMIN_SELECT }),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async summary(productId: number): Promise<ReviewSummaryEntity> {
    const [groups, withPhotos] = await Promise.all([
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { productId, ...PUBLISHED },
        _count: { _all: true },
      }),
      this.prisma.review.count({ where: { productId, ...PUBLISHED, images: { some: {} } } }),
    ]);

    const distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    let count = 0;
    let sum = 0;
    for (const group of groups) {
      const key = String(group.rating) as keyof typeof distribution;
      if (!(key in distribution)) continue;
      distribution[key] = group._count._all;
      count += group._count._all;
      sum += group.rating * group._count._all;
    }

    return new ReviewSummaryEntity({
      average: count === 0 ? 0 : Math.round((sum / count) * 10) / 10,
      count,
      distribution,
      withPhotos,
      recommendRate: count === 0 ? null : (distribution['4'] + distribution['5']) / count,
    });
  }

  /** The latest delivered order with this product, and what variant they got. */
  private async deliveredPurchase(
    userId: number,
    productId: number,
  ): Promise<{ orderId: number; variantLabel: string | null } | null> {
    const item = await this.prisma.orderItem.findFirst({
      where: { productId, order: { userId, status: OrderStatus.DELIVERED } },
      select: {
        orderId: true,
        variant: {
          select: {
            options: {
              select: { attributeOption: { select: { value: true } } },
              orderBy: { id: 'asc' },
            },
          },
        },
      },
      orderBy: { order: { createdAt: 'desc' } },
    });
    if (!item) return null;
    return {
      orderId: item.orderId,
      variantLabel: item.variant
        ? variantLabel(item.variant.options.map((option) => option.attributeOption))
        : null,
    };
  }

  private async assertProduct(productId: number): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product does not exist.');
  }

  private async own(userId: number, id: number): Promise<void> {
    const review = await this.prisma.review.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!review) throw new NotFoundException('Review does not exist.');
  }

  private meta(page: number, limit: number, total: number): PaginationMetaEntity {
    return new PaginationMetaEntity({
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    });
  }

  private statusOf(row: Pick<ReviewRow, 'isApproved' | 'hiddenAt'>): ReviewStatus {
    if (row.isApproved) return 'PUBLISHED';
    return row.hiddenAt ? 'HIDDEN' : 'PENDING';
  }

  private toPublic(row: ReviewRow): PublicReviewEntity {
    return new PublicReviewEntity({
      id: row.id,
      rating: row.rating,
      title: row.title,
      comment: row.comment,
      variantLabel: row.variantLabel,
      verified: row.orderId !== null,
      helpfulCount: row.helpfulCount,
      images: row.images.map(
        (image) => new ReviewImageEntity({ id: image.id, url: image.imageUrl }),
      ),
      reviewer: new ReviewerEntity({
        name: displayName(row.user.name),
        avatarUrl: row.user.avatarUrl,
      }),
      reply: row.reply
        ? new ReviewReplyEntity({ text: row.reply.replyText, createdAt: row.reply.createdAt })
        : null,
      edited:
        row.editedAt !== null && row.editedAt.getTime() - row.createdAt.getTime() > EDIT_GRACE_MS,
      createdAt: row.createdAt,
    });
  }

  private toOwn(row: ReviewRow): OwnReviewEntity {
    return new OwnReviewEntity({
      ...this.toPublic(row),
      productId: row.productId,
      status: this.statusOf(row),
    });
  }

  private toAdmin(row: AdminReviewRow): AdminReviewEntity {
    return new AdminReviewEntity({
      ...this.toOwn(row),
      // Staff see the full name, not the public "First L." form.
      reviewer: new ReviewerEntity({
        name: row.user.name ?? row.user.email,
        avatarUrl: row.user.avatarUrl,
      }),
      product: {
        id: row.product.id,
        name: row.product.name,
        imageUrl: row.product.images[0]?.url ?? null,
      },
      customer: { id: row.user.id, name: row.user.name, email: row.user.email },
      orderId: row.orderId,
    });
  }
}
