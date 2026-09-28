import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Prisma, Role } from '@prisma/client';
import { CouponsService } from './coupons.service';
import { PrismaService } from '../database/prisma.service';
import { CartsService } from '../carts/carts.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const D = (value: number | string) => new Prisma.Decimal(value);

const mockPrisma = {
  coupon: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    fields: { usageLimit: { name: 'usageLimit' } },
  },
  order: { count: jest.fn(), groupBy: jest.fn(), aggregate: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
};
const mockTx = { $executeRaw: jest.fn(), order: { count: jest.fn() } };
const mockCartsService = { getCart: jest.fn() };
const mockAudit = { record: jest.fn() };

const actor: AuthUser = {
  id: 1,
  email: 'owner@example.com',
  role: Role.SUPER_ADMIN,
  isActive: true,
  permissions: [],
};
const ctx = { actor, ip: '127.0.0.1' };

const NOW = new Date('2026-06-01T00:00:00.000Z');

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  code: 'SAVE10',
  description: null,
  discountType: 'PERCENTAGE' as const,
  discountValue: D(10),
  minOrderAmount: D(50),
  maxDiscountAmount: D(20),
  usageLimit: 100,
  perCustomerLimit: null,
  usedCount: 5,
  validFrom: new Date('2020-01-01T00:00:00.000Z'),
  validUntil: new Date('2099-01-01T00:00:00.000Z'),
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const baseDto = {
  code: 'summer',
  discountType: 'PERCENTAGE' as const,
  discountValue: 10,
  validFrom: '2026-06-01T00:00:00.000Z',
  validUntil: '2026-07-01T00:00:00.000Z',
  isActive: true,
};

describe('CouponsService', () => {
  let service: CouponsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CartsService, useValue: mockCartsService },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<CouponsService>(CouponsService);
    jest.clearAllMocks();
    mockPrisma.order.groupBy.mockResolvedValue([]);
  });

  describe('statusOf()', () => {
    it.each([
      ['DISABLED', { isActive: false, validUntil: new Date('2000-01-01') }],
      ['EXPIRED', { validUntil: new Date('2026-05-01') }],
      ['SCHEDULED', { validFrom: new Date('2026-07-01') }],
      ['USED_UP', { usageLimit: 5, usedCount: 5 }],
      ['ACTIVE', {}],
    ])('derives %s', (expected, overrides) => {
      expect(service.statusOf(row(overrides), NOW)).toBe(expected);
    });
  });

  describe('findAll()', () => {
    it('filters by status in the database and attaches real usage', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[row()], 1]);
      mockPrisma.coupon.findMany.mockImplementation((args: unknown) => args);
      mockPrisma.coupon.count.mockImplementation((args: unknown) => args);
      mockPrisma.order.groupBy.mockResolvedValueOnce([
        { couponId: 1, _count: { _all: 3 }, _sum: { discountAmount: D(60), totalAmount: D(900) } },
      ]);

      const page = await service.findAll(
        {
          page: 1,
          limit: 20,
          status: 'EXPIRED',
          sortBy: 'validUntil',
          sortOrder: 'asc',
          search: 'sav',
        },
        NOW,
      );

      const [findArgs] = mockPrisma.$transaction.mock.calls[0][0] as [
        { where: unknown; orderBy: unknown },
      ];
      expect(findArgs.where).toEqual({
        isActive: true,
        validUntil: { lt: NOW },
        code: { contains: 'sav', mode: 'insensitive' },
      });
      expect(findArgs.orderBy).toEqual([{ validUntil: 'asc' }, { id: 'desc' }]);
      expect(page.items[0]?.orderCount).toBe(3);
      expect(page.items[0]?.discountGiven).toEqual(D(60));
      expect(page.items[0]?.status).toBe('ACTIVE');
    });

    it('compares usage against the limit column for USED_UP', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[], 0]);
      mockPrisma.coupon.findMany.mockImplementation((args: unknown) => args);

      await service.findAll(
        { page: 1, limit: 20, status: 'USED_UP', sortBy: 'createdAt', sortOrder: 'desc' },
        NOW,
      );

      const [findArgs] = mockPrisma.$transaction.mock.calls[0][0] as [{ where: unknown }];
      expect(findArgs.where).toMatchObject({
        usedCount: { gte: mockPrisma.coupon.fields.usageLimit },
      });
    });
  });

  describe('create()', () => {
    it('uppercases the code, records an audit entry', async () => {
      mockPrisma.coupon.create.mockResolvedValueOnce(row({ code: 'SUMMER' }));

      await service.create(baseDto, ctx);

      const args = mockPrisma.coupon.create.mock.calls[0][0] as { data: { code: string } };
      expect(args.data.code).toBe('SUMMER');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'coupon.created', targetType: 'coupon' }),
      );
    });

    it('stores 0 and no cap for a free-shipping coupon', async () => {
      mockPrisma.coupon.create.mockResolvedValueOnce(row());

      await service.create({
        ...baseDto,
        discountType: 'FREE_SHIPPING',
        discountValue: 50,
        maxDiscountAmount: 10,
      });

      const args = mockPrisma.coupon.create.mock.calls[0][0] as {
        data: { discountValue: Prisma.Decimal; maxDiscountAmount: unknown };
      };
      expect(args.data.discountValue).toEqual(D(0));
      expect(args.data.maxDiscountAmount).toBeNull();
    });

    it.each([
      [{ discountValue: 150 }, 'between 1 and 100'],
      [{ discountValue: 0 }, 'between 1 and 100'],
      [{ validUntil: '2026-05-01T00:00:00.000Z' }, 'end date'],
      [{ usageLimit: 5, perCustomerLimit: 6 }, 'per customer'],
      [{ discountType: 'FIXED_AMOUNT' as const, discountValue: 0 }, 'takes off'],
    ])('rejects an incoherent coupon %#', async (overrides, message) => {
      await expect(service.create({ ...baseDto, ...overrides })).rejects.toThrow(
        expect.objectContaining({ message: expect.stringContaining(message) }) as Error,
      );
      expect(mockPrisma.coupon.create).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('validates against the merged coupon', async () => {
      mockPrisma.coupon.findUniqueOrThrow.mockResolvedValueOnce(row());

      // Only the end date changes, but it lands before the stored start date.
      await expect(service.update(1, { validUntil: '2019-01-01T00:00:00.000Z' })).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.coupon.update).not.toHaveBeenCalled();
    });

    it('audits a switch-off in plain words', async () => {
      mockPrisma.coupon.findUniqueOrThrow.mockResolvedValueOnce(row());
      mockPrisma.coupon.update.mockResolvedValueOnce(row({ isActive: false }));

      await service.update(1, { isActive: false }, ctx);

      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'coupon.updated',
          summary: 'Switched off coupon SAVE10',
        }),
      );
    });

    it('skips the audit entry when nothing actually changed', async () => {
      mockPrisma.coupon.findUniqueOrThrow.mockResolvedValueOnce(row());
      mockPrisma.coupon.update.mockResolvedValueOnce(row());

      await service.update(1, { isActive: true, code: 'save10' }, ctx);

      expect(mockAudit.record).not.toHaveBeenCalled();
    });
  });

  describe('remove()', () => {
    it('deletes a never-used coupon', async () => {
      mockPrisma.coupon.findUniqueOrThrow.mockResolvedValueOnce({
        code: 'X',
        _count: { orders: 0 },
      });

      await service.remove(1, ctx);

      expect(mockPrisma.coupon.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'coupon.deleted' }),
      );
    });

    it('refuses to delete a coupon that is on orders', async () => {
      mockPrisma.coupon.findUniqueOrThrow.mockResolvedValueOnce({
        code: 'X',
        _count: { orders: 3 },
      });

      await expect(service.remove(1)).rejects.toThrow(ConflictException);
      expect(mockPrisma.coupon.delete).not.toHaveBeenCalled();
    });
  });

  describe('evaluate()', () => {
    it.each([
      ['unknown', null, NotFoundException],
      ['switched off', row({ isActive: false }), NotFoundException],
      ['not started', row({ validFrom: new Date('2026-07-01') }), BadRequestException],
      ['expired', row({ validUntil: new Date('2026-05-01') }), BadRequestException],
      ['used up', row({ usageLimit: 5, usedCount: 5 }), BadRequestException],
    ])('rejects a %s coupon', async (_label, coupon, error) => {
      mockPrisma.coupon.findUnique.mockResolvedValueOnce(coupon);
      await expect(service.evaluate('save10', D(100), { now: NOW })).rejects.toThrow(error);
    });

    it('explains how much more is needed for the minimum', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValueOnce(row({ minOrderAmount: D(1000) }));
      await expect(service.evaluate('save10', D(354), { now: NOW })).rejects.toThrow(
        'Add ৳646 more to use this coupon — it needs an order of ৳1,000.',
      );
    });

    it('enforces the per-customer limit', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValueOnce(row({ perCustomerLimit: 1 }));
      mockPrisma.order.count.mockResolvedValueOnce(1);

      await expect(service.evaluate('save10', D(100), { userId: 7, now: NOW })).rejects.toThrow(
        "You've already used this coupon.",
      );
      expect(mockPrisma.order.count).toHaveBeenCalledWith({
        where: { couponId: 1, userId: 7, status: { not: 'CANCELLED' } },
      });
    });

    it('computes a percentage discount capped at maxDiscountAmount', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValueOnce(row());
      const result = await service.evaluate('save10', D(500), { now: NOW });
      expect(result.discountAmount).toEqual(D(20));
      expect(result.couponId).toBe(1);
      expect(result.freeShipping).toBe(false);
    });

    it('computes an uncapped percentage discount when under the cap', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValueOnce(row());
      const result = await service.evaluate('save10', D(99), { now: NOW });
      expect(result.discountAmount).toEqual(D('9.9'));
    });

    it('never lets the discount exceed the order amount', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValueOnce(
        row({
          discountType: 'FIXED_AMOUNT',
          discountValue: D(500),
          minOrderAmount: null,
          maxDiscountAmount: null,
        }),
      );
      const result = await service.evaluate('save10', D(120), { now: NOW });
      expect(result.discountAmount).toEqual(D(120));
    });

    it('flags free shipping with no money off the items', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValueOnce(
        row({ discountType: 'FREE_SHIPPING', discountValue: D(0), maxDiscountAmount: null }),
      );
      const result = await service.evaluate('save10', D(500), { now: NOW });
      expect(result.freeShipping).toBe(true);
      expect(result.discountAmount).toEqual(D(0));
    });
  });

  describe('validate()', () => {
    it('rejects an empty cart', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValueOnce(
        row({ validFrom: new Date('2000-01-01') }),
      );
      mockCartsService.getCart.mockResolvedValueOnce({ items: [], totalPrice: D(0) });
      await expect(service.validate(7, { code: 'SAVE10' })).rejects.toThrow('empty cart');
    });
  });

  describe('redeem() / release()', () => {
    const coupon = {
      couponId: 1,
      code: 'SAVE10',
      discountType: 'PERCENTAGE' as const,
      discountValue: D(10),
      discountAmount: D(10),
      orderAmount: D(100),
      freeShipping: false,
      perCustomerLimit: 2,
    };

    it('counts a use and re-checks the per-customer limit under the row lock', async () => {
      mockTx.$executeRaw.mockResolvedValueOnce(1);
      mockTx.order.count.mockResolvedValueOnce(1);

      await service.redeem(mockTx as never, coupon, 7);

      expect(mockTx.order.count).toHaveBeenCalled();
    });

    it('409s when the last use was just taken', async () => {
      mockTx.$executeRaw.mockResolvedValueOnce(0);
      await expect(service.redeem(mockTx as never, coupon, 7)).rejects.toThrow(ConflictException);
    });

    it('rejects a concurrent second use by the same customer', async () => {
      mockTx.$executeRaw.mockResolvedValueOnce(1);
      mockTx.order.count.mockResolvedValueOnce(2);
      await expect(service.redeem(mockTx as never, coupon, 7)).rejects.toThrow(BadRequestException);
    });

    it('releases by id, falling back to the code for legacy orders', async () => {
      await service.release(mockTx as never, { couponId: 1, couponCode: 'SAVE10' });
      await service.release(mockTx as never, { couponId: null, couponCode: 'OLD' });
      await service.release(mockTx as never, { couponId: null, couponCode: null });
      expect(mockTx.$executeRaw).toHaveBeenCalledTimes(2);
    });
  });
});
