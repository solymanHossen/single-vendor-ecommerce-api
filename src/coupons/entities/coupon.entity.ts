import { ApiProperty } from '@nestjs/swagger';
import type { DiscountType, Prisma } from '@prisma/client';

interface CouponEntityInput {
  id: number;
  code: string;
  discountType: DiscountType;
  discountValue: Prisma.Decimal;
  minOrderAmount: Prisma.Decimal | null;
  maxDiscountAmount: Prisma.Decimal | null;
  usageLimit: number | null;
  usedCount: number;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class CouponEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'SAVE10' })
  code: string;

  @ApiProperty({ enum: ['PERCENTAGE', 'FIXED_AMOUNT'] })
  discountType: DiscountType;

  @ApiProperty({
    type: String,
    example: '10.00',
    description: 'Decimal amount serialized as a string',
  })
  discountValue: Prisma.Decimal;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '50.00',
    description: 'Decimal amount serialized as a string',
  })
  minOrderAmount: Prisma.Decimal | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '20.00',
    description: 'Decimal amount serialized as a string',
  })
  maxDiscountAmount: Prisma.Decimal | null;

  @ApiProperty({ nullable: true, example: 100 })
  usageLimit: number | null;

  @ApiProperty({ example: 12 })
  usedCount: number;

  @ApiProperty()
  validFrom: Date;

  @ApiProperty()
  validUntil: Date;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: CouponEntityInput) {
    this.id = partial.id;
    this.code = partial.code;
    this.discountType = partial.discountType;
    this.discountValue = partial.discountValue;
    this.minOrderAmount = partial.minOrderAmount;
    this.maxDiscountAmount = partial.maxDiscountAmount;
    this.usageLimit = partial.usageLimit;
    this.usedCount = partial.usedCount;
    this.validFrom = partial.validFrom;
    this.validUntil = partial.validUntil;
    this.isActive = partial.isActive;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}

interface CouponValidationEntityInput {
  code: string;
  discountType: DiscountType;
  discountValue: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  orderAmount: Prisma.Decimal;
}

export class CouponValidationEntity {
  @ApiProperty({ example: 'SAVE10' })
  code: string;

  @ApiProperty({ enum: ['PERCENTAGE', 'FIXED_AMOUNT'] })
  discountType: DiscountType;

  @ApiProperty({
    type: String,
    example: '10.00',
    description: "The coupon's configured discount value, serialized as a string",
  })
  discountValue: Prisma.Decimal;

  @ApiProperty({
    type: String,
    example: '9.90',
    description: 'The actual discount computed for the current cart, serialized as a string',
  })
  discountAmount: Prisma.Decimal;

  @ApiProperty({
    type: String,
    example: '99.00',
    description:
      "The current cart's total this coupon was validated against, serialized as a string",
  })
  orderAmount: Prisma.Decimal;

  constructor(partial: CouponValidationEntityInput) {
    this.code = partial.code;
    this.discountType = partial.discountType;
    this.discountValue = partial.discountValue;
    this.discountAmount = partial.discountAmount;
    this.orderAmount = partial.orderAmount;
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

interface PaginatedCouponsEntityInput {
  items: CouponEntity[];
  meta: PaginationMetaEntity;
}

export class PaginatedCouponsEntity {
  @ApiProperty({ type: () => CouponEntity, isArray: true })
  items: CouponEntity[];

  @ApiProperty({ type: () => PaginationMetaEntity })
  meta: PaginationMetaEntity;

  constructor(partial: PaginatedCouponsEntityInput) {
    this.items = partial.items;
    this.meta = partial.meta;
  }
}
