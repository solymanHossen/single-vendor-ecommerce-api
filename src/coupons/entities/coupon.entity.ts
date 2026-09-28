import { ApiProperty } from '@nestjs/swagger';
import type { DiscountType, OrderStatus, Prisma } from '@prisma/client';
import { COUPON_STATUSES, type CouponStatus } from '../coupons.constants';

const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING'];
const MONEY = { type: String, description: 'Decimal amount serialized as a string' } as const;

interface CouponStatsInput {
  /** Non-cancelled orders that used the coupon. */
  orderCount: number;
  discountGiven: Prisma.Decimal;
  revenue: Prisma.Decimal;
}

export interface CouponEntityInput extends CouponStatsInput {
  id: number;
  code: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: Prisma.Decimal;
  minOrderAmount: Prisma.Decimal | null;
  maxDiscountAmount: Prisma.Decimal | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  usedCount: number;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
  status: CouponStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class CouponEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'SAVE10' })
  code: string;

  @ApiProperty({ nullable: true, example: 'Newsletter sign-up reward' })
  description: string | null;

  @ApiProperty({ enum: DISCOUNT_TYPES })
  discountType: DiscountType;

  @ApiProperty({ ...MONEY, example: '10.00' })
  discountValue: Prisma.Decimal;

  @ApiProperty({ ...MONEY, nullable: true, example: '50.00' })
  minOrderAmount: Prisma.Decimal | null;

  @ApiProperty({ ...MONEY, nullable: true, example: '20.00' })
  maxDiscountAmount: Prisma.Decimal | null;

  @ApiProperty({ nullable: true, example: 100 })
  usageLimit: number | null;

  @ApiProperty({ nullable: true, example: 1, description: 'Uses allowed per customer' })
  perCustomerLimit: number | null;

  @ApiProperty({ example: 12 })
  usedCount: number;

  @ApiProperty()
  validFrom: Date;

  @ApiProperty()
  validUntil: Date;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ enum: COUPON_STATUSES, description: 'Derived from isActive, dates and usage' })
  status: CouponStatus;

  @ApiProperty({ example: 9, description: 'Non-cancelled orders that used this coupon' })
  orderCount: number;

  @ApiProperty({ ...MONEY, example: '1840.00' })
  discountGiven: Prisma.Decimal;

  @ApiProperty({ ...MONEY, example: '48210.00', description: 'Order totals with this coupon' })
  revenue: Prisma.Decimal;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: CouponEntityInput) {
    this.id = partial.id;
    this.code = partial.code;
    this.description = partial.description;
    this.discountType = partial.discountType;
    this.discountValue = partial.discountValue;
    this.minOrderAmount = partial.minOrderAmount;
    this.maxDiscountAmount = partial.maxDiscountAmount;
    this.usageLimit = partial.usageLimit;
    this.perCustomerLimit = partial.perCustomerLimit;
    this.usedCount = partial.usedCount;
    this.validFrom = partial.validFrom;
    this.validUntil = partial.validUntil;
    this.isActive = partial.isActive;
    this.status = partial.status;
    this.orderCount = partial.orderCount;
    this.discountGiven = partial.discountGiven;
    this.revenue = partial.revenue;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}

export interface CouponOrderEntityInput {
  id: number;
  status: OrderStatus;
  totalAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  customer: { id: number; name: string | null; email: string } | null;
  createdAt: Date;
}

export class CouponOrderEntity {
  @ApiProperty({ example: 331 })
  id: number;

  @ApiProperty({ example: 'DELIVERED' })
  status: OrderStatus;

  @ApiProperty(MONEY)
  totalAmount: Prisma.Decimal;

  @ApiProperty(MONEY)
  discountAmount: Prisma.Decimal;

  @ApiProperty({ nullable: true })
  customer: { id: number; name: string | null; email: string } | null;

  @ApiProperty()
  createdAt: Date;

  constructor(partial: CouponOrderEntityInput) {
    this.id = partial.id;
    this.status = partial.status;
    this.totalAmount = partial.totalAmount;
    this.discountAmount = partial.discountAmount;
    this.customer = partial.customer;
    this.createdAt = partial.createdAt;
  }
}

export class CouponDetailEntity extends CouponEntity {
  @ApiProperty({ example: 7, description: 'Distinct customers who used it' })
  customerCount: number;

  @ApiProperty({ type: () => CouponOrderEntity, isArray: true })
  recentOrders: CouponOrderEntity[];

  constructor(
    partial: CouponEntityInput & { customerCount: number; recentOrders: CouponOrderEntity[] },
  ) {
    super(partial);
    this.customerCount = partial.customerCount;
    this.recentOrders = partial.recentOrders;
  }
}

export class CouponSummaryEntity {
  @ApiProperty({ example: { ACTIVE: 4, SCHEDULED: 1, EXPIRED: 2, USED_UP: 1, DISABLED: 1 } })
  statusCounts: Record<CouponStatus, number>;

  @ApiProperty({ example: 9 })
  total: number;

  @ApiProperty({ example: 38, description: 'Non-cancelled orders that used any coupon' })
  orderCount: number;

  @ApiProperty(MONEY)
  discountGiven: Prisma.Decimal;

  @ApiProperty(MONEY)
  revenue: Prisma.Decimal;

  @ApiProperty({ nullable: true, example: 'FLASH20', description: 'Active coupon ending soonest' })
  endingSoon: { id: number; code: string; validUntil: Date } | null;

  constructor(partial: CouponSummaryEntity) {
    this.statusCounts = partial.statusCounts;
    this.total = partial.total;
    this.orderCount = partial.orderCount;
    this.discountGiven = partial.discountGiven;
    this.revenue = partial.revenue;
    this.endingSoon = partial.endingSoon;
  }
}

interface CouponValidationEntityInput {
  couponId: number;
  code: string;
  discountType: DiscountType;
  discountValue: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  orderAmount: Prisma.Decimal;
  freeShipping: boolean;
  perCustomerLimit: number | null;
}

export class CouponValidationEntity {
  @ApiProperty({ example: 1 })
  couponId: number;

  @ApiProperty({ example: 'SAVE10' })
  code: string;

  @ApiProperty({ enum: DISCOUNT_TYPES })
  discountType: DiscountType;

  @ApiProperty({
    ...MONEY,
    example: '10.00',
    description: "The coupon's configured discount value, serialized as a string",
  })
  discountValue: Prisma.Decimal;

  @ApiProperty({
    ...MONEY,
    example: '9.90',
    description: 'Money off the items (0 for FREE_SHIPPING), serialized as a string',
  })
  discountAmount: Prisma.Decimal;

  @ApiProperty({
    ...MONEY,
    example: '99.00',
    description: 'The amount this coupon was validated against, serialized as a string',
  })
  orderAmount: Prisma.Decimal;

  @ApiProperty({ example: false, description: 'Delivery fee is waived' })
  freeShipping: boolean;

  @ApiProperty({ nullable: true, example: 1 })
  perCustomerLimit: number | null;

  constructor(partial: CouponValidationEntityInput) {
    this.couponId = partial.couponId;
    this.code = partial.code;
    this.discountType = partial.discountType;
    this.discountValue = partial.discountValue;
    this.discountAmount = partial.discountAmount;
    this.orderAmount = partial.orderAmount;
    this.freeShipping = partial.freeShipping;
    this.perCustomerLimit = partial.perCustomerLimit;
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
