import { ApiProperty } from '@nestjs/swagger';

export class ReviewerSummaryEntity {
  @ApiProperty({ example: 7 })
  id: number;

  @ApiProperty({ nullable: true, example: 'Jane Doe' })
  name: string | null;

  constructor(partial: ReviewerSummaryEntity) {
    this.id = partial.id;
    this.name = partial.name;
  }
}

export class ReviewImageEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'https://cdn.example.com/reviews/1/photo.jpg' })
  imageUrl: string;

  constructor(partial: ReviewImageEntity) {
    this.id = partial.id;
    this.imageUrl = partial.imageUrl;
  }
}

interface ReviewReplyEntityInput {
  id: number;
  adminId: number;
  replyText: string;
  createdAt: Date;
}

export class ReviewReplyEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 3 })
  adminId: number;

  @ApiProperty({ example: 'Thanks for the feedback — glad you liked it!' })
  replyText: string;

  @ApiProperty()
  createdAt: Date;

  constructor(partial: ReviewReplyEntityInput) {
    this.id = partial.id;
    this.adminId = partial.adminId;
    this.replyText = partial.replyText;
    this.createdAt = partial.createdAt;
  }
}

interface ReviewEntityInput {
  id: number;
  userId: number;
  reviewer: ReviewerSummaryEntity;
  productId: number;
  orderId: number | null;
  rating: number;
  comment: string | null;
  isApproved: boolean;
  images: ReviewImageEntity[];
  reply: ReviewReplyEntity | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ReviewEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 7 })
  userId: number;

  @ApiProperty({ type: () => ReviewerSummaryEntity })
  reviewer: ReviewerSummaryEntity;

  @ApiProperty({ example: 101 })
  productId: number;

  @ApiProperty({
    nullable: true,
    example: 301,
    description: 'Order this review is a verified purchase of',
  })
  orderId: number | null;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  rating: number;

  @ApiProperty({ nullable: true, example: 'Great product, fast shipping!' })
  comment: string | null;

  @ApiProperty({ example: false })
  isApproved: boolean;

  @ApiProperty({ type: () => ReviewImageEntity, isArray: true })
  images: ReviewImageEntity[];

  @ApiProperty({ type: () => ReviewReplyEntity, nullable: true })
  reply: ReviewReplyEntity | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: ReviewEntityInput) {
    this.id = partial.id;
    this.userId = partial.userId;
    this.reviewer = partial.reviewer;
    this.productId = partial.productId;
    this.orderId = partial.orderId;
    this.rating = partial.rating;
    this.comment = partial.comment;
    this.isApproved = partial.isApproved;
    this.images = partial.images;
    this.reply = partial.reply;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}

interface PaginationMetaEntityInput {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class PaginationMetaEntity {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  constructor(partial: PaginationMetaEntityInput) {
    this.page = partial.page;
    this.limit = partial.limit;
    this.total = partial.total;
    this.totalPages = partial.totalPages;
  }
}

interface PaginatedReviewsEntityInput {
  items: ReviewEntity[];
  meta: PaginationMetaEntity;
}

export class PaginatedReviewsEntity {
  @ApiProperty({ type: () => ReviewEntity, isArray: true })
  items: ReviewEntity[];

  @ApiProperty({ type: () => PaginationMetaEntity })
  meta: PaginationMetaEntity;

  constructor(partial: PaginatedReviewsEntityInput) {
    this.items = partial.items;
    this.meta = partial.meta;
  }
}
