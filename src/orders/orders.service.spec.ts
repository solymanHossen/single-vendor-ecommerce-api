import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Prisma, Role } from '@prisma/client';
import { OrdersService } from './orders.service';
import { PrismaService } from '../database/prisma.service';
import { CartsService } from '../carts/carts.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockTx = {
  product: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  order: {
    create: jest.fn(),
  },
};

const mockPrisma = {
  address: { findFirst: jest.fn() },
  order: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockCartsService = {
  getCart: jest.fn(),
  clearCart: jest.fn(),
};

const sampleAddress = {
  addressLine1: '123 Main St',
  addressLine2: null,
  city: 'Springfield',
  state: 'IL',
  postalCode: '62704',
  country: 'USA',
};

const sampleCart = {
  items: [
    {
      productId: 101,
      name: 'iPhone 17 Pro',
      slug: 'x',
      imageUrl: null,
      unitPrice: new Prisma.Decimal(999),
      quantity: 2,
      subtotal: new Prisma.Decimal(1998),
    },
  ],
  totalItems: 2,
  totalPrice: new Prisma.Decimal(1998),
};

const sampleProductRow = {
  id: 101,
  name: 'iPhone 17 Pro',
  isPublished: true,
  stockQuantity: 10,
  basePrice: new Prisma.Decimal(999),
  discountPrice: null,
};

const sampleOrderRow = {
  id: 301,
  userId: 7,
  status: 'PENDING',
  paymentStatus: 'UNPAID',
  totalAmount: new Prisma.Decimal(1998),
  discountAmount: new Prisma.Decimal(0),
  shippingFee: new Prisma.Decimal(0),
  shippingAddress: sampleAddress,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  items: [
    {
      id: 501,
      productId: 101,
      quantity: 2,
      unitPrice: new Prisma.Decimal(999),
      product: { id: 101, name: 'iPhone 17 Pro', slug: 'iphone-17-pro', images: [] },
    },
  ],
};

const regularUser: AuthUser = { id: 7, email: 'a@b.com', role: Role.USER, isActive: true };
const adminUser: AuthUser = { id: 99, email: 'admin@b.com', role: Role.ADMIN, isActive: true };

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CartsService, useValue: mockCartsService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (arg: unknown) =>
      typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(mockTx) : arg,
    );
  });

  describe('placeOrder()', () => {
    it('throws NotFoundException when the address does not belong to the user', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(null);

      await expect(service.placeOrder(7, { addressId: 999 })).rejects.toThrow(NotFoundException);
      expect(mockCartsService.getCart).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the cart is empty', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(sampleAddress);
      mockCartsService.getCart.mockResolvedValueOnce({
        items: [],
        totalItems: 0,
        totalPrice: new Prisma.Decimal(0),
      });

      await expect(service.placeOrder(7, { addressId: 1 })).rejects.toThrow(BadRequestException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws ConflictException listing every problem when stock/availability validation fails', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(sampleAddress);
      mockCartsService.getCart.mockResolvedValueOnce(sampleCart);
      mockTx.product.findMany.mockResolvedValueOnce([{ ...sampleProductRow, stockQuantity: 1 }]);

      await expect(service.placeOrder(7, { addressId: 1 })).rejects.toThrow(ConflictException);
      expect(mockTx.product.updateMany).not.toHaveBeenCalled();
      expect(mockTx.order.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when a cart product no longer exists', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(sampleAddress);
      mockCartsService.getCart.mockResolvedValueOnce(sampleCart);
      mockTx.product.findMany.mockResolvedValueOnce([]);

      await expect(service.placeOrder(7, { addressId: 1 })).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when a cart product has been unpublished', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(sampleAddress);
      mockCartsService.getCart.mockResolvedValueOnce(sampleCart);
      mockTx.product.findMany.mockResolvedValueOnce([{ ...sampleProductRow, isPublished: false }]);

      await expect(service.placeOrder(7, { addressId: 1 })).rejects.toThrow(ConflictException);
    });

    it('decrements stock, creates the order, and clears the cart on success', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(sampleAddress);
      mockCartsService.getCart.mockResolvedValueOnce(sampleCart);
      mockTx.product.findMany.mockResolvedValueOnce([sampleProductRow]);
      mockTx.product.updateMany.mockResolvedValueOnce({ count: 1 });
      mockTx.order.create.mockResolvedValueOnce(sampleOrderRow);

      const result = await service.placeOrder(7, { addressId: 1 });

      expect(mockTx.product.updateMany).toHaveBeenCalledWith({
        where: { id: 101, stockQuantity: { gte: 2 } },
        data: { stockQuantity: { decrement: 2 } },
      });
      expect(mockTx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 7,
            items: {
              create: [{ productId: 101, quantity: 2, unitPrice: new Prisma.Decimal(999) }],
            },
          }),
        }),
      );
      expect(mockCartsService.clearCart).toHaveBeenCalledWith({ type: 'user', id: 7 });
      expect(result.id).toBe(301);
      expect(result.items[0]?.subtotal.toString()).toBe('1998');
    });

    it('throws ConflictException when the atomic decrement loses a stock race', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(sampleAddress);
      mockCartsService.getCart.mockResolvedValueOnce(sampleCart);
      mockTx.product.findMany.mockResolvedValueOnce([sampleProductRow]);
      mockTx.product.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.placeOrder(7, { addressId: 1 })).rejects.toThrow(ConflictException);
      expect(mockTx.order.create).not.toHaveBeenCalled();
    });

    it('still returns the order when clearing the cart afterward fails', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(sampleAddress);
      mockCartsService.getCart.mockResolvedValueOnce(sampleCart);
      mockTx.product.findMany.mockResolvedValueOnce([sampleProductRow]);
      mockTx.product.updateMany.mockResolvedValueOnce({ count: 1 });
      mockTx.order.create.mockResolvedValueOnce(sampleOrderRow);
      mockCartsService.clearCart.mockRejectedValueOnce(new Error('redis down'));

      const result = await service.placeOrder(7, { addressId: 1 });

      expect(result.id).toBe(301);
    });
  });

  describe('findAll()', () => {
    it('forces the where clause to the caller for a plain USER, ignoring query.userId', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[sampleOrderRow], 1]);

      await service.findAll(regularUser, {
        page: 1,
        limit: 20,
        sortOrder: 'desc',
        userId: 999,
      });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 7 } }),
      );
    });

    it('honors query.userId for ADMIN/SUPER_ADMIN callers', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[], 0]);

      await service.findAll(adminUser, { page: 1, limit: 20, sortOrder: 'desc', userId: 42 });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 42 } }),
      );
    });

    it('returns every order for staff when no userId filter is given', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[], 0]);

      await service.findAll(adminUser, { page: 1, limit: 20, sortOrder: 'desc' });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('computes totalPages from the count', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[sampleOrderRow], 41]);

      const result = await service.findAll(regularUser, { page: 1, limit: 20, sortOrder: 'desc' });

      expect(result.meta).toEqual({ page: 1, limit: 20, total: 41, totalPages: 3 });
    });
  });

  describe('findOne()', () => {
    it('scopes the lookup to the caller for a plain USER', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(sampleOrderRow);

      await service.findOne(regularUser, 301);

      expect(mockPrisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 301, userId: 7 } }),
      );
    });

    it('allows ADMIN/SUPER_ADMIN to fetch any order', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(sampleOrderRow);

      await service.findOne(adminUser, 301);

      expect(mockPrisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 301 } }),
      );
    });

    it('throws NotFoundException when the order does not exist or is not owned by the caller', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(null);

      await expect(service.findOne(regularUser, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus()', () => {
    it('updates the status and returns the mapped entity', async () => {
      mockPrisma.order.update.mockResolvedValueOnce({ ...sampleOrderRow, status: 'SHIPPED' });

      const result = await service.updateStatus(301, { status: 'SHIPPED' });

      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 301 },
        data: { status: 'SHIPPED' },
        select: expect.any(Object),
      });
      expect(result.status).toBe('SHIPPED');
    });
  });
});
