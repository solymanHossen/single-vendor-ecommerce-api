import { Injectable } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma, Role, TicketStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { LOW_STOCK_THRESHOLD } from '../products/products.constants';
import {
  AnalyticsDashboardEntity,
  AnalyticsSummaryEntity,
  DailyPointEntity,
  LowStockEntity,
  MetricEntity,
  OperationsEntity,
  PaymentMixEntity,
  RecentOrderEntity,
  ReviewInsightEntity,
  StatusCountEntity,
  TopProductEntity,
} from './entities/analytics.entity';

const MS_PER_DAY = 86_400_000;
/** Asia/Dhaka is UTC+6 all year (no DST), so day boundaries are a fixed offset. */
const DHAKA_OFFSET_MS = 6 * 3_600_000;
const TOP_PRODUCTS_LIMIT = 5;
const RECENT_ORDERS_LIMIT = 8;
const LATEST_REVIEWS_LIMIT = 4;

/** Orders in these states never became (or stopped being) sales. */
const NON_SALE_STATUSES: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.RETURNED];

const ORDER_STATUS_ORDER: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.RETURNED,
];

export interface AnalyticsWindow {
  /** Start of the current window (UTC instant at a Dhaka midnight). */
  since: Date;
  /** Start of the previous, equal-length comparison window. */
  previousSince: Date;
  /** Dhaka calendar dates covered by the current window, oldest first. */
  days: string[];
}

/**
 * Computes the reporting window: `rangeDays` whole Dhaka calendar days
 * ending today, plus the same-length window right before it.
 */
export function buildWindow(rangeDays: number, now: Date = new Date()): AnalyticsWindow {
  const localNow = now.getTime() + DHAKA_OFFSET_MS;
  const todayStartUtc = Math.floor(localNow / MS_PER_DAY) * MS_PER_DAY - DHAKA_OFFSET_MS;
  const sinceMs = todayStartUtc - (rangeDays - 1) * MS_PER_DAY;

  const days = Array.from({ length: rangeDays }, (_, index) =>
    new Date(sinceMs + DHAKA_OFFSET_MS + index * MS_PER_DAY).toISOString().slice(0, 10),
  );

  return {
    since: new Date(sinceMs),
    previousSince: new Date(sinceMs - rangeDays * MS_PER_DAY),
    days,
  };
}

/** Percentage change, one decimal; null when the base period had nothing to compare. */
export function percentChange(current: Prisma.Decimal, previous: Prisma.Decimal): number | null {
  if (previous.isZero()) return null;
  return current.minus(previous).dividedBy(previous).times(100).toDecimalPlaces(1).toNumber();
}

/** `decimals` is 2 for money and 0 for counts (orders, customers). */
function metric(current: Prisma.Decimal, previous: Prisma.Decimal, decimals = 2): MetricEntity {
  return new MetricEntity({
    value: current.toFixed(decimals),
    previous: previous.toFixed(decimals),
    changePercent: percentChange(current, previous),
  });
}

function average(total: Prisma.Decimal, count: number): Prisma.Decimal {
  return count === 0 ? new Prisma.Decimal(0) : total.dividedBy(count);
}

interface TotalsRow {
  revenue: string;
  prev_revenue: string;
  orders: number;
  prev_orders: number;
  paid_orders: number;
  prev_paid_orders: number;
}

interface DailyRow {
  day: string;
  revenue: string;
  orders: number;
}

interface TopProductRow {
  id: number;
  name: string;
  category_name: string;
  units: number;
  revenue: string;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Everything the admin overview renders, in one round of parallel queries.
   * Revenue counts PAID orders only; order counts include every order placed.
   */
  async getDashboard(rangeDays: number, now: Date = new Date()): Promise<AnalyticsDashboardEntity> {
    const window = buildWindow(rangeDays, now);

    const [
      totals,
      customers,
      previousCustomers,
      dailyRows,
      statusGroups,
      paymentGroups,
      topRows,
      recentOrders,
      reviews,
      operations,
      lowStock,
    ] = await Promise.all([
      this.loadTotals(window),
      this.prisma.user.count({ where: { role: Role.USER, createdAt: { gte: window.since } } }),
      this.prisma.user.count({
        where: { role: Role.USER, createdAt: { gte: window.previousSince, lt: window.since } },
      }),
      this.loadDaily(window),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { createdAt: { gte: window.since } },
        _count: { _all: true },
      }),
      this.prisma.payment.groupBy({
        by: ['provider'],
        where: { status: PaymentStatus.PAID, order: { createdAt: { gte: window.since } } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.loadTopProducts(window),
      this.loadRecentOrders(),
      this.loadReviewInsight(),
      this.loadOperations(),
      this.loadLowStock(),
    ]);

    const revenue = new Prisma.Decimal(totals.revenue);
    const previousRevenue = new Prisma.Decimal(totals.prev_revenue);

    const summary = new AnalyticsSummaryEntity({
      revenue: metric(revenue, previousRevenue),
      orders: metric(new Prisma.Decimal(totals.orders), new Prisma.Decimal(totals.prev_orders), 0),
      averageOrderValue: metric(
        average(revenue, totals.paid_orders),
        average(previousRevenue, totals.prev_paid_orders),
      ),
      newCustomers: metric(new Prisma.Decimal(customers), new Prisma.Decimal(previousCustomers), 0),
    });

    const dailyByDay = new Map(dailyRows.map((row) => [row.day, row]));
    const statusCounts = new Map(statusGroups.map((group) => [group.status, group._count._all]));

    return new AnalyticsDashboardEntity({
      rangeDays,
      from: window.since.toISOString(),
      to: now.toISOString(),
      summary,
      // Days without orders are filled with zeros so the chart has no gaps.
      daily: window.days.map((day) => {
        const row = dailyByDay.get(day);
        return new DailyPointEntity({
          date: day,
          revenue: row ? new Prisma.Decimal(row.revenue).toFixed(2) : '0.00',
          orders: row?.orders ?? 0,
        });
      }),
      ordersByStatus: ORDER_STATUS_ORDER.map(
        (status) => new StatusCountEntity({ status, count: statusCounts.get(status) ?? 0 }),
      ),
      paymentMix: paymentGroups
        .map(
          (group) =>
            new PaymentMixEntity({
              provider: group.provider,
              count: group._count._all,
              amount: (group._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
            }),
        )
        .sort((a, b) => b.count - a.count),
      topProducts: topRows,
      recentOrders,
      reviews,
      operations,
      lowStock,
    });
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  private async loadTotals(window: AnalyticsWindow): Promise<TotalsRow> {
    const [row] = await this.prisma.$queryRaw<TotalsRow[]>(Prisma.sql`
      SELECT
        COALESCE(SUM(total_amount) FILTER (
          WHERE payment_status = 'PAID' AND created_at >= ${window.since}), 0)::text AS revenue,
        COALESCE(SUM(total_amount) FILTER (
          WHERE payment_status = 'PAID' AND created_at < ${window.since}), 0)::text AS prev_revenue,
        COUNT(*) FILTER (WHERE created_at >= ${window.since})::int AS orders,
        COUNT(*) FILTER (WHERE created_at < ${window.since})::int AS prev_orders,
        COUNT(*) FILTER (
          WHERE payment_status = 'PAID' AND created_at >= ${window.since})::int AS paid_orders,
        COUNT(*) FILTER (
          WHERE payment_status = 'PAID' AND created_at < ${window.since})::int AS prev_paid_orders
      FROM orders
      WHERE created_at >= ${window.previousSince}
    `);
    return (
      row ?? {
        revenue: '0',
        prev_revenue: '0',
        orders: 0,
        prev_orders: 0,
        paid_orders: 0,
        prev_paid_orders: 0,
      }
    );
  }

  /** Revenue and order count per Dhaka calendar day (created_at is stored as UTC). */
  private async loadDaily(window: AnalyticsWindow): Promise<DailyRow[]> {
    return this.prisma.$queryRaw<DailyRow[]>(Prisma.sql`
      SELECT
        to_char((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka', 'YYYY-MM-DD') AS day,
        COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'PAID'), 0)::text AS revenue,
        COUNT(*)::int AS orders
      FROM orders
      WHERE created_at >= ${window.since}
      GROUP BY 1
    `);
  }

  private async loadTopProducts(window: AnalyticsWindow): Promise<TopProductEntity[]> {
    const rows = await this.prisma.$queryRaw<TopProductRow[]>(Prisma.sql`
      SELECT p.id, p.name, c.name AS category_name,
        SUM(oi.quantity)::int AS units,
        SUM(oi.quantity * oi.unit_price)::text AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      JOIN categories c ON c.id = p.category_id
      WHERE o.created_at >= ${window.since}
        AND o.status NOT IN (${Prisma.join(NON_SALE_STATUSES)})
      GROUP BY p.id, p.name, c.name
      ORDER BY SUM(oi.quantity * oi.unit_price) DESC, p.id ASC
      LIMIT ${TOP_PRODUCTS_LIMIT}
    `);
    if (rows.length === 0) return [];

    const thumbnails = await this.thumbnailsFor(rows.map((row) => row.id));
    return rows.map(
      (row) =>
        new TopProductEntity({
          id: row.id,
          name: row.name,
          categoryName: row.category_name,
          thumbnailUrl: thumbnails.get(row.id) ?? null,
          units: row.units,
          revenue: new Prisma.Decimal(row.revenue).toFixed(2),
        }),
    );
  }

  private async loadRecentOrders(): Promise<RecentOrderEntity[]> {
    const orders = await this.prisma.order.findMany({
      select: {
        id: true,
        totalAmount: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        payment: { select: { provider: true } },
        _count: { select: { items: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: RECENT_ORDERS_LIMIT,
    });

    return orders.map(
      (order) =>
        new RecentOrderEntity({
          id: order.id,
          customerName: order.user?.name ?? null,
          customerEmail: order.user?.email ?? null,
          itemCount: order._count.items,
          totalAmount: order.totalAmount.toFixed(2),
          status: order.status,
          paymentStatus: order.paymentStatus,
          paymentProvider: order.payment?.provider ?? null,
          createdAt: order.createdAt.toISOString(),
        }),
    );
  }

  private async loadReviewInsight(): Promise<ReviewInsightEntity> {
    const [groups, pendingCount, latest] = await Promise.all([
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { isApproved: true },
        _count: { _all: true },
      }),
      this.prisma.review.count({ where: { isApproved: false } }),
      this.prisma.review.findMany({
        select: {
          id: true,
          rating: true,
          comment: true,
          isApproved: true,
          createdAt: true,
          user: { select: { name: true } },
          product: { select: { name: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: LATEST_REVIEWS_LIMIT,
      }),
    ]);

    const distribution: Record<'1' | '2' | '3' | '4' | '5', number> = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    };
    let count = 0;
    let sum = 0;
    for (const group of groups) {
      const key = String(group.rating);
      if (key === '1' || key === '2' || key === '3' || key === '4' || key === '5') {
        distribution[key] += group._count._all;
        count += group._count._all;
        sum += group.rating * group._count._all;
      }
    }

    return new ReviewInsightEntity({
      averageRating: count === 0 ? 0 : Math.round((sum / count) * 10) / 10,
      approvedCount: count,
      pendingCount,
      distribution,
      latest: latest.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        isApproved: review.isApproved,
        customerName: review.user.name,
        productName: review.product.name,
        createdAt: review.createdAt.toISOString(),
      })),
    });
  }

  private async loadOperations(): Promise<OperationsEntity> {
    const [awaitingFulfilment, pendingReturns, openTickets, pendingReviews] = await Promise.all([
      this.prisma.order.count({
        where: { status: { in: [OrderStatus.PENDING, OrderStatus.PROCESSING] } },
      }),
      this.prisma.returnRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.ticket.count({
        where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] } },
      }),
      this.prisma.review.count({ where: { isApproved: false } }),
    ]);
    return new OperationsEntity({
      awaitingFulfilment,
      pendingReturns,
      openTickets,
      pendingReviews,
    });
  }

  private async loadLowStock(): Promise<LowStockEntity[]> {
    const products = await this.prisma.product.findMany({
      where: { isPublished: true, stockQuantity: { lte: LOW_STOCK_THRESHOLD } },
      select: {
        id: true,
        name: true,
        stockQuantity: true,
        images: {
          select: { url: true },
          orderBy: [{ isThumbnail: 'desc' }, { id: 'asc' }],
          take: 1,
        },
      },
      orderBy: [{ stockQuantity: 'asc' }, { id: 'asc' }],
      take: 6,
    });
    return products.map(
      (product) =>
        new LowStockEntity({
          id: product.id,
          name: product.name,
          stockQuantity: product.stockQuantity,
          thumbnailUrl: product.images[0]?.url ?? null,
        }),
    );
  }

  private async thumbnailsFor(productIds: number[]): Promise<Map<number, string>> {
    const images = await this.prisma.productImage.findMany({
      where: { productId: { in: productIds } },
      select: { productId: true, url: true },
      orderBy: [{ isThumbnail: 'desc' }, { id: 'asc' }],
    });
    const map = new Map<number, string>();
    for (const image of images) {
      if (!map.has(image.productId)) map.set(image.productId, image.url);
    }
    return map;
  }
}
