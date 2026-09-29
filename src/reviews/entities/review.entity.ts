import { ApiProperty } from '@nestjs/swagger';
import { REVIEW_STATUSES, type ReviewBlocker, type ReviewStatus } from '../reviews.constants';

export class ReviewImageEntity {
  @ApiProperty({ example: 3 })
  id: number;

  @ApiProperty()
  url: string;

  constructor(partial: ReviewImageEntity) {
    this.id = partial.id;
    this.url = partial.url;
  }
}

export class ReviewerEntity {
  @ApiProperty({ example: 'Nusrat J.', description: 'First name and last initial' })
  name: string;

  @ApiProperty({ nullable: true })
  avatarUrl: string | null;

  constructor(partial: ReviewerEntity) {
    this.name = partial.name;
    this.avatarUrl = partial.avatarUrl;
  }
}

export class ReviewReplyEntity {
  @ApiProperty()
  text: string;

  @ApiProperty()
  createdAt: Date;

  constructor(partial: ReviewReplyEntity) {
    this.text = partial.text;
    this.createdAt = partial.createdAt;
  }
}

export class PublicReviewEntity {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ minimum: 1, maximum: 5 })
  rating: number;

  @ApiProperty({ nullable: true, example: 'Crisp screen, great battery' })
  title: string | null;

  @ApiProperty({ nullable: true })
  comment: string | null;

  @ApiProperty({ nullable: true, example: 'Black · 128GB' })
  variantLabel: string | null;

  @ApiProperty({ description: 'Written against a delivered order' })
  verified: boolean;

  @ApiProperty({ example: 4 })
  helpfulCount: number;

  @ApiProperty({ type: () => ReviewImageEntity, isArray: true })
  images: ReviewImageEntity[];

  @ApiProperty({ type: () => ReviewerEntity })
  reviewer: ReviewerEntity;

  @ApiProperty({
    type: () => ReviewReplyEntity,
    nullable: true,
    description: 'Response from the store',
  })
  reply: ReviewReplyEntity | null;

  @ApiProperty({ description: 'Changed by its author after posting' })
  edited: boolean;

  @ApiProperty()
  createdAt: Date;

  constructor(partial: PublicReviewEntity) {
    this.id = partial.id;
    this.rating = partial.rating;
    this.title = partial.title;
    this.comment = partial.comment;
    this.variantLabel = partial.variantLabel;
    this.verified = partial.verified;
    this.helpfulCount = partial.helpfulCount;
    this.images = partial.images;
    this.reviewer = partial.reviewer;
    this.reply = partial.reply;
    this.edited = partial.edited;
    this.createdAt = partial.createdAt;
  }
}

export class OwnReviewEntity extends PublicReviewEntity {
  @ApiProperty({ example: 42 })
  productId: number;

  @ApiProperty({ enum: REVIEW_STATUSES })
  status: ReviewStatus;

  constructor(partial: OwnReviewEntity) {
    super(partial);
    this.productId = partial.productId;
    this.status = partial.status;
  }
}

export class AdminReviewEntity extends OwnReviewEntity {
  @ApiProperty()
  product: { id: number; name: string; imageUrl: string | null };

  @ApiProperty()
  customer: { id: number; name: string | null; email: string };

  @ApiProperty({ nullable: true })
  orderId: number | null;

  constructor(partial: AdminReviewEntity) {
    super(partial);
    this.product = partial.product;
    this.customer = partial.customer;
    this.orderId = partial.orderId;
  }
}

export class ReviewSummaryEntity {
  @ApiProperty({ example: 4.4 })
  average: number;

  @ApiProperty({ example: 27 })
  count: number;

  @ApiProperty({ example: { '5': 16, '4': 6, '3': 3, '2': 1, '1': 1 } })
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;

  @ApiProperty({ example: 6, description: 'Published reviews with photos' })
  withPhotos: number;

  @ApiProperty({ nullable: true, example: 0.81, description: 'Share of 4★ and 5★ reviews' })
  recommendRate: number | null;

  constructor(partial: ReviewSummaryEntity) {
    this.average = partial.average;
    this.count = partial.count;
    this.distribution = partial.distribution;
    this.withPhotos = partial.withPhotos;
    this.recommendRate = partial.recommendRate;
  }
}

export class PaginationMetaEntity {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 5 })
  limit: number;

  @ApiProperty({ example: 27 })
  total: number;

  @ApiProperty({ example: 6 })
  totalPages: number;

  constructor(partial: PaginationMetaEntity) {
    this.page = partial.page;
    this.limit = partial.limit;
    this.total = partial.total;
    this.totalPages = partial.totalPages;
  }
}

export class ProductReviewsEntity {
  @ApiProperty({ type: () => PublicReviewEntity, isArray: true })
  items: PublicReviewEntity[];

  @ApiProperty({ type: () => PaginationMetaEntity })
  meta: PaginationMetaEntity;

  @ApiProperty({ type: () => ReviewSummaryEntity })
  summary: ReviewSummaryEntity;

  constructor(partial: ProductReviewsEntity) {
    this.items = partial.items;
    this.meta = partial.meta;
    this.summary = partial.summary;
  }
}

export class MyReviewStatusEntity {
  @ApiProperty({ description: 'Can write a review for this product now' })
  eligible: boolean;

  @ApiProperty({ nullable: true, enum: ['NOT_PURCHASED', 'NOT_DELIVERED', 'ALREADY_REVIEWED'] })
  blocker: ReviewBlocker | null;

  @ApiProperty({ type: () => OwnReviewEntity, nullable: true })
  review: OwnReviewEntity | null;

  @ApiProperty({ type: [Number], description: 'Reviews on this product the viewer marked helpful' })
  votedReviewIds: number[];

  constructor(partial: MyReviewStatusEntity) {
    this.eligible = partial.eligible;
    this.blocker = partial.blocker;
    this.review = partial.review;
    this.votedReviewIds = partial.votedReviewIds;
  }
}

export class PaginatedAdminReviewsEntity {
  @ApiProperty({ type: () => AdminReviewEntity, isArray: true })
  items: AdminReviewEntity[];

  @ApiProperty({ type: () => PaginationMetaEntity })
  meta: PaginationMetaEntity;

  @ApiProperty({ example: { PENDING: 3, PUBLISHED: 184, HIDDEN: 2, ALL: 189 } })
  counts: Record<ReviewStatus | 'ALL', number>;

  constructor(partial: PaginatedAdminReviewsEntity) {
    this.items = partial.items;
    this.meta = partial.meta;
    this.counts = partial.counts;
  }
}
