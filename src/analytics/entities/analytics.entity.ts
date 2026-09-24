import { ApiProperty } from '@nestjs/swagger';
import type { OrderStatus, PaymentProvider, PaymentStatus } from '@prisma/client';

// Admin dashboard payload. Money is serialized as decimal strings (API-wide
// convention); dates as ISO strings; "change" values are percentages vs the
// previous period of equal length (null when that period had no activity).

export class MetricEntity {
  @ApiProperty({ example: '482350.00' })
  value: string;

  @ApiProperty({ example: '401200.00' })
  previous: string;

  @ApiProperty({ nullable: true, example: 20.2 })
  changePercent: number | null;

  constructor(partial: MetricEntity) {
    this.value = partial.value;
    this.previous = partial.previous;
    this.changePercent = partial.changePercent;
  }
}

export class AnalyticsSummaryEntity {
  @ApiProperty({ type: MetricEntity, description: 'Paid order revenue (BDT)' })
  revenue: MetricEntity;

  @ApiProperty({ type: MetricEntity, description: 'Orders placed' })
  orders: MetricEntity;

  @ApiProperty({ type: MetricEntity, description: 'Revenue ÷ paid orders (BDT)' })
  averageOrderValue: MetricEntity;

  @ApiProperty({ type: MetricEntity, description: 'Customer accounts created' })
  newCustomers: MetricEntity;

  constructor(partial: AnalyticsSummaryEntity) {
    this.revenue = partial.revenue;
    this.orders = partial.orders;
    this.averageOrderValue = partial.averageOrderValue;
    this.newCustomers = partial.newCustomers;
  }
}

export class DailyPointEntity {
  @ApiProperty({ example: '2026-09-24', description: 'Calendar day in Asia/Dhaka' })
  date: string;

  @ApiProperty({ example: '18490.00' })
  revenue: string;

  @ApiProperty({ example: 7 })
  orders: number;

  constructor(partial: DailyPointEntity) {
    this.date = partial.date;
    this.revenue = partial.revenue;
    this.orders = partial.orders;
  }
}

export class StatusCountEntity {
  @ApiProperty({ enum: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'] })
  status: OrderStatus;

  @ApiProperty({ example: 42 })
  count: number;

  constructor(partial: StatusCountEntity) {
    this.status = partial.status;
    this.count = partial.count;
  }
}

export class PaymentMixEntity {
  @ApiProperty({ enum: ['STRIPE', 'SSLCOMMERZ', 'BKASH', 'COD'] })
  provider: PaymentProvider;

  @ApiProperty({ example: 31 })
  count: number;

  @ApiProperty({ example: '220400.00' })
  amount: string;

  constructor(partial: PaymentMixEntity) {
    this.provider = partial.provider;
    this.count = partial.count;
    this.amount = partial.amount;
  }
}

export class TopProductEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Apple iPhone 15 Pro' })
  name: string;

  @ApiProperty({ example: 'Smartphones' })
  categoryName: string;

  @ApiProperty({ nullable: true })
  thumbnailUrl: string | null;

  @ApiProperty({ example: 6 })
  units: number;

  @ApiProperty({ example: '929994.00' })
  revenue: string;

  constructor(partial: TopProductEntity) {
    this.id = partial.id;
    this.name = partial.name;
    this.categoryName = partial.categoryName;
    this.thumbnailUrl = partial.thumbnailUrl;
    this.units = partial.units;
    this.revenue = partial.revenue;
  }
}

export class RecentOrderEntity {
  @ApiProperty({ example: 320 })
  id: number;

  @ApiProperty({ nullable: true, example: 'Nusrat Jahan' })
  customerName: string | null;

  @ApiProperty({ nullable: true, example: 'customer@example.com' })
  customerEmail: string | null;

  @ApiProperty({ example: 3 })
  itemCount: number;

  @ApiProperty({ example: '12490.00' })
  totalAmount: string;

  @ApiProperty({ enum: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'] })
  status: OrderStatus;

  @ApiProperty({ enum: ['UNPAID', 'PAID', 'FAILED', 'REFUNDED'] })
  paymentStatus: PaymentStatus;

  @ApiProperty({ nullable: true, enum: ['STRIPE', 'SSLCOMMERZ', 'BKASH', 'COD'] })
  paymentProvider: PaymentProvider | null;

  @ApiProperty({ example: '2026-09-24T08:00:00.000Z' })
  createdAt: string;

  constructor(partial: RecentOrderEntity) {
    this.id = partial.id;
    this.customerName = partial.customerName;
    this.customerEmail = partial.customerEmail;
    this.itemCount = partial.itemCount;
    this.totalAmount = partial.totalAmount;
    this.status = partial.status;
    this.paymentStatus = partial.paymentStatus;
    this.paymentProvider = partial.paymentProvider;
    this.createdAt = partial.createdAt;
  }
}

export class ReviewInsightEntity {
  @ApiProperty({ example: 4.1 })
  averageRating: number;

  @ApiProperty({ example: 184 })
  approvedCount: number;

  @ApiProperty({ example: 39, description: 'Reviews waiting for moderation' })
  pendingCount: number;

  @ApiProperty({
    example: { '1': 4, '2': 11, '3': 25, '4': 58, '5': 86 },
    description: 'Approved reviews per star rating',
  })
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;

  @ApiProperty({ isArray: true, description: 'Latest reviews (approved or pending)' })
  latest: Array<{
    id: number;
    rating: number;
    comment: string | null;
    isApproved: boolean;
    customerName: string | null;
    productName: string;
    createdAt: string;
  }>;

  constructor(partial: ReviewInsightEntity) {
    this.averageRating = partial.averageRating;
    this.approvedCount = partial.approvedCount;
    this.pendingCount = partial.pendingCount;
    this.distribution = partial.distribution;
    this.latest = partial.latest;
  }
}

export class OperationsEntity {
  @ApiProperty({ example: 66, description: 'Orders PENDING or PROCESSING' })
  awaitingFulfilment: number;

  @ApiProperty({ example: 5 })
  pendingReturns: number;

  @ApiProperty({ example: 18, description: 'Tickets OPEN or IN_PROGRESS' })
  openTickets: number;

  @ApiProperty({ example: 39 })
  pendingReviews: number;

  constructor(partial: OperationsEntity) {
    this.awaitingFulfilment = partial.awaitingFulfilment;
    this.pendingReturns = partial.pendingReturns;
    this.openTickets = partial.openTickets;
    this.pendingReviews = partial.pendingReviews;
  }
}

export class LowStockEntity {
  @ApiProperty({ example: 42 })
  id: number;

  @ApiProperty({ example: 'Lightweight Nylon Bomber Jacket' })
  name: string;

  @ApiProperty({ example: 0 })
  stockQuantity: number;

  @ApiProperty({ nullable: true })
  thumbnailUrl: string | null;

  constructor(partial: LowStockEntity) {
    this.id = partial.id;
    this.name = partial.name;
    this.stockQuantity = partial.stockQuantity;
    this.thumbnailUrl = partial.thumbnailUrl;
  }
}

export class AnalyticsDashboardEntity {
  @ApiProperty({ example: 30 })
  rangeDays: number;

  @ApiProperty({ example: '2026-08-26T18:00:00.000Z', description: 'Window start (UTC instant)' })
  from: string;

  @ApiProperty({ example: '2026-09-24T10:00:00.000Z' })
  to: string;

  @ApiProperty({ type: AnalyticsSummaryEntity })
  summary: AnalyticsSummaryEntity;

  @ApiProperty({ type: DailyPointEntity, isArray: true })
  daily: DailyPointEntity[];

  @ApiProperty({ type: StatusCountEntity, isArray: true })
  ordersByStatus: StatusCountEntity[];

  @ApiProperty({ type: PaymentMixEntity, isArray: true })
  paymentMix: PaymentMixEntity[];

  @ApiProperty({ type: TopProductEntity, isArray: true })
  topProducts: TopProductEntity[];

  @ApiProperty({ type: RecentOrderEntity, isArray: true })
  recentOrders: RecentOrderEntity[];

  @ApiProperty({ type: ReviewInsightEntity })
  reviews: ReviewInsightEntity;

  @ApiProperty({ type: OperationsEntity })
  operations: OperationsEntity;

  @ApiProperty({ type: LowStockEntity, isArray: true })
  lowStock: LowStockEntity[];

  constructor(partial: AnalyticsDashboardEntity) {
    this.rangeDays = partial.rangeDays;
    this.from = partial.from;
    this.to = partial.to;
    this.summary = partial.summary;
    this.daily = partial.daily;
    this.ordersByStatus = partial.ordersByStatus;
    this.paymentMix = partial.paymentMix;
    this.topProducts = partial.topProducts;
    this.recentOrders = partial.recentOrders;
    this.reviews = partial.reviews;
    this.operations = partial.operations;
    this.lowStock = partial.lowStock;
  }
}
