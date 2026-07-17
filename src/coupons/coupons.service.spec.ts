import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { CouponsService } from './coupons.service';
import { PrismaService } from '../database/prisma.service';
import { CartsService } from '../carts/carts.service';

const mockPrisma = {
  coupon: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockCartsService = {
  getCart: jest.fn(),
};

const sampleCouponRow = {
  id: 1,
  code: 'SAVE10',
  discountType: 'PERCENTAGE' as const,
  discountValue: new Prisma.Decimal(10),
  minOrderAmount: new Prisma.Decimal(50),
  maxDiscountAmount: new Prisma.Decimal(20),
  usageLimit: 100,
  usedCount: 5,
  validFrom: new Date('2020-01-01T00:00:00.000Z'),
  validUntil: new Date('2099-01-01T00:00:00.000Z'),
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const sampleCart = {
  items: [
    {
      productId: 1,
      name: 'x',
      slug: 'x',
      imageUrl: null,
      unitPrice: new Prisma.Decimal(99),
      quantity: 1,
      subtotal: new Prisma.Decimal(99),
    },
  ],
  totalItems: 1,
  totalPrice: new Prisma.Decimal(99),
};

describe('CouponsService', () => {
  let service: CouponsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CartsService, useValue: mockCartsService },
      ],
    }).compile();

    service = module.get<CouponsService>(CouponsService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('builds an isActive + search where clause', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[], 0]);

      await service.findAll({
        page: 1,
        limit: 20,
        sortOrder: 'desc',
        isActive: true,
        search: 'save',
      });

      expect(mockPrisma.coupon.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, code: { contains: 'save', mode: 'insensitive' } },
        }),
      );
    });
  });

  describe('findOne()', () => {
    it('maps the Prisma row into a CouponEntity', async () => {
      mockPrisma.coupon.findUniqueOrThrow.mockResolvedValueOnce(sampleCouponRow);

      const result = await service.findOne(1);

      expect(result.code).toBe('SAVE10');
    });
  });

  describe('create()', () => {
    it('uppercases the code before persisting', async () => {
      mockPrisma.coupon.create.mockResolvedValueOnce(sampleCouponRow);

      await service.create({
        code: 'save10',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        validFrom: '2020-01-01T00:00:00Z',
        validUntil: '2099-01-01T00:00:00Z',
        isActive: true,
      });

      expect(mockPrisma.coupon.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ code: 'SAVE10' }) }),
      );
    });
  });

  describe('update()', () => {
    it('uppercases the code when provided', async () => {
      mockPrisma.coupon.update.mockResolvedValueOnce(sampleCouponRow);

      await service.update(1, { code: 'newcode' });

      expect(mockPrisma.coupon.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { code: 'NEWCODE' },
        select: expect.any(Object),
      });
    });

    it('leaves code untouched when not provided', async () => {
      mockPrisma.coupon.update.mockResolvedValueOnce(sampleCouponRow);

      await service.update(1, { isActive: false });

      expect(mockPrisma.coupon.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isActive: false },
        select: expect.any(Object),
      });
    });
  });

  describe('remove()', () => {
    it('deletes the coupon by id', async () => {
      mockPrisma.coupon.delete.mockResolvedValueOnce(sampleCouponRow);

      await service.remove(1);

      expect(mockPrisma.coupon.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('validate()', () => {
    it('throws NotFoundException when the code does not exist', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValueOnce(null);

      await expect(service.validate(1, { code: 'NOPE' })).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the coupon is deactivated', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValueOnce({ ...sampleCouponRow, isActive: false });

      await expect(service.validate(1, { code: 'SAVE10' })).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the coupon has not started yet', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValueOnce({
        ...sampleCouponRow,
        validFrom: new Date('2099-01-01T00:00:00.000Z'),
      });

      await expect(service.validate(1, { code: 'SAVE10' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the coupon has expired', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValueOnce({
        ...sampleCouponRow,
        validUntil: new Date('2020-01-01T00:00:00.000Z'),
      });

      await expect(service.validate(1, { code: 'SAVE10' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the usage limit has been reached', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValueOnce({
        ...sampleCouponRow,
        usageLimit: 5,
        usedCount: 5,
      });

      await expect(service.validate(1, { code: 'SAVE10' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the cart is empty', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValueOnce(sampleCouponRow);
      mockCartsService.getCart.mockResolvedValueOnce({
        items: [],
        totalItems: 0,
        totalPrice: new Prisma.Decimal(0),
      });

      await expect(service.validate(1, { code: 'SAVE10' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the order total is below minOrderAmount', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValueOnce(sampleCouponRow);
      mockCartsService.getCart.mockResolvedValueOnce({
        items: [
          {
            productId: 1,
            name: 'x',
            slug: 'x',
            imageUrl: null,
            unitPrice: new Prisma.Decimal(10),
            quantity: 1,
            subtotal: new Prisma.Decimal(10),
          },
        ],
        totalItems: 1,
        totalPrice: new Prisma.Decimal(10),
      });

      await expect(service.validate(1, { code: 'SAVE10' })).rejects.toThrow(BadRequestException);
    });

    it('computes a percentage discount capped at maxDiscountAmount', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValueOnce(sampleCouponRow);
      mockCartsService.getCart.mockResolvedValueOnce({
        items: [
          {
            productId: 1,
            name: 'x',
            slug: 'x',
            imageUrl: null,
            unitPrice: new Prisma.Decimal(500),
            quantity: 1,
            subtotal: new Prisma.Decimal(500),
          },
        ],
        totalItems: 1,
        totalPrice: new Prisma.Decimal(500),
      });

      // 10% of 500 = 50, but maxDiscountAmount is 20
      const result = await service.validate(1, { code: 'save10' });

      expect(result.discountAmount.toString()).toBe('20');
      expect(result.orderAmount.toString()).toBe('500');
    });

    it('computes an uncapped percentage discount when under maxDiscountAmount', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValueOnce(sampleCouponRow);
      mockCartsService.getCart.mockResolvedValueOnce(sampleCart);

      // 10% of 99 = 9.9, under the 20 cap
      const result = await service.validate(1, { code: 'SAVE10' });

      expect(result.discountAmount.toString()).toBe('9.9');
    });

    it('never lets the discount exceed the order amount', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValueOnce({
        ...sampleCouponRow,
        discountType: 'FIXED_AMOUNT',
        discountValue: new Prisma.Decimal(500),
        maxDiscountAmount: null,
        minOrderAmount: null,
      });
      mockCartsService.getCart.mockResolvedValueOnce(sampleCart);

      const result = await service.validate(1, { code: 'SAVE10' });

      expect(result.discountAmount.toString()).toBe('99');
    });
  });
});
