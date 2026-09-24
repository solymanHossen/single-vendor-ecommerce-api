import { Test, type TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AnalyticsService, buildWindow, percentChange } from './analytics.service';
import { PrismaService } from '../database/prisma.service';

const mockPrisma = {
  user: { count: jest.fn() },
  order: { groupBy: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  payment: { groupBy: jest.fn() },
  review: { groupBy: jest.fn(), count: jest.fn(), findMany: jest.fn() },
  returnRequest: { count: jest.fn() },
  ticket: { count: jest.fn() },
  product: { findMany: jest.fn() },
  productImage: { findMany: jest.fn() },
  $queryRaw: jest.fn(),
};

// 2026-09-24 10:00 UTC = 16:00 in Dhaka.
const NOW = new Date('2026-09-24T10:00:00.000Z');

describe('buildWindow()', () => {
  it('covers whole Dhaka calendar days ending today', () => {
    const window = buildWindow(7, NOW);

    expect(window.days).toEqual([
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
    ]);
    // Dhaka midnight of 2026-09-18 is 18:00 UTC the day before.
    expect(window.since.toISOString()).toBe('2026-09-17T18:00:00.000Z');
    expect(window.previousSince.toISOString()).toBe('2026-09-10T18:00:00.000Z');
  });

  it('rolls over to the next Dhaka day after 18:00 UTC', () => {
    const window = buildWindow(1, new Date('2026-09-24T18:30:00.000Z'));
    expect(window.days).toEqual(['2026-09-25']);
  });
});

describe('percentChange()', () => {
  it('returns one-decimal growth', () => {
    expect(percentChange(new Prisma.Decimal(150), new Prisma.Decimal(120))).toBe(25);
    expect(percentChange(new Prisma.Decimal(90), new Prisma.Decimal(120))).toBe(-25);
  });

  it('is null when there is no base period to compare with', () => {
    expect(percentChange(new Prisma.Decimal(10), new Prisma.Decimal(0))).toBeNull();
  });
});

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalyticsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    jest.resetAllMocks();

    mockPrisma.$queryRaw.mockImplementation((sql: Prisma.Sql) => {
      const text = sql.sql;
      if (text.includes('prev_revenue')) {
        return Promise.resolve([
          {
            revenue: '3000.00',
            prev_revenue: '2000.00',
            orders: 12,
            prev_orders: 8,
            paid_orders: 10,
            prev_paid_orders: 5,
          },
        ]);
      }
      if (text.includes('to_char')) {
        return Promise.resolve([{ day: '2026-09-23', revenue: '1500.00', orders: 4 }]);
      }
      return Promise.resolve([
        { id: 7, name: 'Phone', category_name: 'Smartphones', units: 3, revenue: '2700.00' },
      ]);
    });
    mockPrisma.user.count.mockResolvedValueOnce(6).mockResolvedValueOnce(3);
    mockPrisma.order.groupBy.mockResolvedValue([
      { status: 'DELIVERED', _count: { _all: 5 } },
      { status: 'PENDING', _count: { _all: 2 } },
    ]);
    mockPrisma.payment.groupBy.mockResolvedValue([
      { provider: 'COD', _count: { _all: 2 }, _sum: { amount: new Prisma.Decimal(500) } },
      { provider: 'BKASH', _count: { _all: 6 }, _sum: { amount: new Prisma.Decimal(2500) } },
    ]);
    mockPrisma.order.findMany.mockResolvedValue([]);
    mockPrisma.order.count.mockResolvedValue(9);
    mockPrisma.review.groupBy.mockResolvedValue([
      { rating: 5, _count: { _all: 3 } },
      { rating: 3, _count: { _all: 1 } },
    ]);
    mockPrisma.review.count.mockResolvedValue(2);
    mockPrisma.review.findMany.mockResolvedValue([]);
    mockPrisma.returnRequest.count.mockResolvedValue(1);
    mockPrisma.ticket.count.mockResolvedValue(4);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.productImage.findMany.mockResolvedValue([
      { productId: 7, url: 'https://cdn.example.com/7.jpg' },
    ]);
  });

  it('computes KPIs against the previous period', async () => {
    const dashboard = await service.getDashboard(7, NOW);

    expect(dashboard.summary.revenue).toEqual({
      value: '3000.00',
      previous: '2000.00',
      changePercent: 50,
    });
    expect(dashboard.summary.orders).toEqual({ value: '12', previous: '8', changePercent: 50 });
    // 3000/10 = 300 vs 2000/5 = 400
    expect(dashboard.summary.averageOrderValue.value).toBe('300.00');
    expect(dashboard.summary.averageOrderValue.changePercent).toBe(-25);
    expect(dashboard.summary.newCustomers).toEqual({
      value: '6',
      previous: '3',
      changePercent: 100,
    });
  });

  it('fills every day of the window, zeroing days without orders', async () => {
    const dashboard = await service.getDashboard(7, NOW);

    expect(dashboard.daily).toHaveLength(7);
    expect(dashboard.daily.find((day) => day.date === '2026-09-23')).toEqual({
      date: '2026-09-23',
      revenue: '1500.00',
      orders: 4,
    });
    expect(dashboard.daily[0]).toEqual({ date: '2026-09-18', revenue: '0.00', orders: 0 });
  });

  it('returns every order status in lifecycle order and payments by volume', async () => {
    const dashboard = await service.getDashboard(7, NOW);

    expect(dashboard.ordersByStatus.map((row) => row.status)).toEqual([
      'PENDING',
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
      'RETURNED',
    ]);
    expect(dashboard.ordersByStatus.find((row) => row.status === 'PROCESSING')?.count).toBe(0);
    expect(dashboard.paymentMix.map((row) => row.provider)).toEqual(['BKASH', 'COD']);
  });

  it('summarises reviews and attaches product thumbnails', async () => {
    const dashboard = await service.getDashboard(7, NOW);

    expect(dashboard.reviews.averageRating).toBe(4.5);
    expect(dashboard.reviews.distribution).toEqual({ '1': 0, '2': 0, '3': 1, '4': 0, '5': 3 });
    expect(dashboard.topProducts[0]?.thumbnailUrl).toBe('https://cdn.example.com/7.jpg');
    expect(dashboard.operations).toEqual({
      awaitingFulfilment: 9,
      pendingReturns: 1,
      openTickets: 4,
      pendingReviews: 2,
    });
  });
});
