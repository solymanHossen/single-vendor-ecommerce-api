import { Test, type TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import {
  CouponEntity,
  CouponValidationEntity,
  PaginatedCouponsEntity,
} from './entities/coupon.entity';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockCouponsService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  validate: jest.fn(),
  summary: jest.fn(),
};

const currentUser: AuthUser = {
  id: 7,
  email: 'a@b.com',
  role: Role.USER,
  isActive: true,
  permissions: [],
};

const sampleCoupon = new CouponEntity({
  id: 1,
  code: 'SAVE10',
  description: null,
  discountType: 'PERCENTAGE',
  discountValue: 10 as unknown as CouponEntity['discountValue'],
  minOrderAmount: null,
  maxDiscountAmount: null,
  usageLimit: null,
  perCustomerLimit: null,
  usedCount: 0,
  status: 'ACTIVE',
  orderCount: 0,
  discountGiven: 0 as unknown as CouponEntity['discountGiven'],
  revenue: 0 as unknown as CouponEntity['revenue'],
  validFrom: new Date(),
  validUntil: new Date(),
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('CouponsController', () => {
  let controller: CouponsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CouponsController],
      providers: [{ provide: CouponsService, useValue: mockCouponsService }],
    }).compile();

    controller = module.get<CouponsController>(CouponsController);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('delegates to the service and wraps the result', async () => {
      const paginated = new PaginatedCouponsEntity({
        items: [sampleCoupon],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
      mockCouponsService.findAll.mockResolvedValueOnce(paginated);
      const query = {
        page: 1,
        limit: 20,
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
      };

      const result = await controller.findAll(query);

      expect(mockCouponsService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual({ message: 'Coupons retrieved successfully', data: paginated });
    });
  });

  describe('findOne()', () => {
    it('delegates to the service and wraps the result', async () => {
      mockCouponsService.findOne.mockResolvedValueOnce(sampleCoupon);

      const result = await controller.findOne(1);

      expect(mockCouponsService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual({ message: 'Coupon retrieved successfully', data: sampleCoupon });
    });
  });

  describe('create()', () => {
    it('delegates to the service and wraps the result', async () => {
      mockCouponsService.create.mockResolvedValueOnce(sampleCoupon);
      const dto = {
        code: 'SAVE10',
        discountType: 'PERCENTAGE' as const,
        discountValue: 10,
        validFrom: '2026-01-01T00:00:00Z',
        validUntil: '2099-01-01T00:00:00Z',
        isActive: true,
      };

      const result = await controller.create(currentUser, '::1', dto);

      expect(mockCouponsService.create).toHaveBeenCalledWith(dto, {
        actor: currentUser,
        ip: '::1',
      });
      expect(result).toEqual({ message: 'Coupon created successfully', data: sampleCoupon });
    });
  });

  describe('update()', () => {
    it('delegates to the service with id and dto', async () => {
      mockCouponsService.update.mockResolvedValueOnce(sampleCoupon);

      const result = await controller.update(currentUser, '::1', 1, { isActive: false });

      expect(mockCouponsService.update).toHaveBeenCalledWith(
        1,
        { isActive: false },
        { actor: currentUser, ip: '::1' },
      );
      expect(result).toEqual({ message: 'Coupon updated successfully', data: sampleCoupon });
    });
  });

  describe('remove()', () => {
    it('delegates to the service and returns a null-data envelope', async () => {
      mockCouponsService.remove.mockResolvedValueOnce(undefined);

      const result = await controller.remove(currentUser, '::1', 1);

      expect(mockCouponsService.remove).toHaveBeenCalledWith(1, { actor: currentUser, ip: '::1' });
      expect(result).toEqual({ message: 'Coupon deleted successfully', data: null });
    });
  });

  describe('validate()', () => {
    it("delegates to the service with the current user's id and dto", async () => {
      const validation = new CouponValidationEntity({
        couponId: 1,
        freeShipping: false,
        perCustomerLimit: null,
        code: 'SAVE10',
        discountType: 'PERCENTAGE',
        discountValue: 10 as unknown as CouponValidationEntity['discountValue'],
        discountAmount: 9.9 as unknown as CouponValidationEntity['discountAmount'],
        orderAmount: 99 as unknown as CouponValidationEntity['orderAmount'],
      });
      mockCouponsService.validate.mockResolvedValueOnce(validation);

      const result = await controller.validate(currentUser, { code: 'SAVE10' });

      expect(mockCouponsService.validate).toHaveBeenCalledWith(7, { code: 'SAVE10' });
      expect(result).toEqual({ message: 'Coupon is valid', data: validation });
    });
  });
});
