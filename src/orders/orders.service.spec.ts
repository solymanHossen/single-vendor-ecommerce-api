import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Prisma, Role } from '@prisma/client';
import { OrdersService } from './orders.service';
import { PrismaService } from '../database/prisma.service';
import { CartsService } from '../carts/carts.service';
import { CouponsService } from '../coupons/coupons.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { FREE_SHIPPING_THRESHOLD, ORDER_TRANSITIONS } from './orders.constants';

const D = (value: number) => new Prisma.Decimal(value);

const mockTx = {
  product: { findMany: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
  productVariant: { findMany: jest.fn(), updateMany: jest.fn(), groupBy: jest.fn() },
  order: {
    create: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  payment: { update: jest.fn() },
  $executeRaw: jest.fn(),
};

const mockPrisma = {
  address: { findFirst: jest.fn() },
  order: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockCartsService = { getCart: jest.fn(), clearCart: jest.fn() };
const mockCouponsService = { evaluate: jest.fn() };

const customer: AuthUser = { id: 7, email: 'a@b.com', role: Role.USER, isActive: true };
const admin: AuthUser = { id: 1, email: 'admin@b.com', role: Role.ADMIN, isActive: true };

const address = {
  recipientName: 'Nusrat Jahan',
  phone: '01711000000',
  addressLine1: 'House 12, Road 5',
  addressLine2: null,
  city: 'Dhaka',
  state: 'Dhaka Division',
  postalCode: '1209',
  country: 'Bangladesh',
  user: { name: 'Nusrat', phone: '01800000000' },
};

function cartItem(overrides: Record<string, unknown> = {}) {
  return {
    key: '101:204',
    productId: 101,
    variantId: 204,
    name: 'iPhone 17 Pro',
    variantLabel: 'Black · 256GB',
    quantity: 2,
    availableStock: 5,
    subtotal: D(2400),
    issue: null,
    ...overrides,
  };
}

function cart(items = [cartItem()], hasIssues = false) {
  return {
    items,
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    totalPrice: items.reduce((sum, item) => sum.plus(item.subtotal), D(0)),
    hasIssues,
  };
}

const orderRow = {
  id: 301,
  userId: 7,
  user: { id: 7, name: 'Nusrat', email: 'a@b.com', phone: '01711000000' },
  status: 'PENDING' as const,
  paymentStatus: 'UNPAID' as const,
  payment: { provider: 'COD' as const, status: 'UNPAID' as const, transactionId: null },
  totalAmount: D(2460),
  discountAmount: D(0),
  shippingFee: D(60),
  couponCode: null,
  note: null,
  shippingAddress: { ...address, user: undefined },
  items: [
    {
      id: 501,
      productId: 101,
      variantId: 204,
      quantity: 2,
      unitPrice: D(1200),
      product: { id: 101, name: 'iPhone 17 Pro', slug: 'iphone-17-pro', sku: 'IPH17', images: [] },
      variant: {
        sku: 'IPH17-BLK-256',
        imageUrl: null,
        options: [{ attributeOption: { value: 'Black' } }, { attributeOption: { value: '256GB' } }],
      },
    },
  ],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

/** Fresh rows the transaction reads: variant 204 of product 101, sale-free. */
function stockRows(variantStock = 5) {
  mockTx.product.findMany.mockResolvedValue([
    {
      id: 101,
      name: 'iPhone 17 Pro',
      isPublished: true,
      stockQuantity: 20,
      basePrice: D(1000),
      discountPrice: null,
    },
  ]);
  mockTx.productVariant.findMany.mockResolvedValue([
    { id: 204, productId: 101, price: D(1200), stockQuantity: variantStock },
  ]);
}

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CartsService, useValue: mockCartsService },
        { provide: CouponsService, useValue: mockCouponsService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.resetAllMocks();
    mockPrisma.$transaction.mockImplementation((run: (tx: typeof mockTx) => unknown) =>
      run(mockTx),
    );
    mockTx.productVariant.updateMany.mockResolvedValue({ count: 1 });
    mockTx.product.updateMany.mockResolvedValue({ count: 1 });
    mockTx.productVariant.groupBy.mockResolvedValue([
      { productId: 101, _sum: { stockQuantity: 18 } },
    ]);
    mockTx.$executeRaw.mockResolvedValue(1);
    mockTx.order.create.mockResolvedValue(orderRow);
  });

  describe('quote()', () => {
    it('prices subtotal, coupon and Dhaka shipping without writing anything', async () => {
      mockCartsService.getCart.mockResolvedValueOnce(cart());
      mockPrisma.address.findFirst.mockResolvedValueOnce({ city: 'Dhaka' });
      mockCouponsService.evaluate.mockResolvedValueOnce({
        code: 'FLASH20',
        discountType: 'PERCENTAGE',
        discountValue: D(20),
        discountAmount: D(480),
      });

      const quote = await service.quote(7, { addressId: 1, couponCode: 'flash20' });

      expect(quote.subtotal).toEqual(D(2400));
      expect(quote.discountAmount).toEqual(D(480));
      expect(quote.shippingFee).toEqual(D(60));
      expect(quote.totalAmount).toEqual(D(1980));
      expect(quote.insideDhaka).toBe(true);
      expect(quote.amountToFreeShipping).toEqual(D(FREE_SHIPPING_THRESHOLD - 2400));
      expect(quote.problems).toEqual([]);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('charges the outside-Dhaka fee and leaves shipping unknown without an address', async () => {
      mockCartsService.getCart.mockResolvedValue(cart());
      mockPrisma.address.findFirst.mockResolvedValueOnce({ city: 'Chattogram' });

      expect((await service.quote(7, { addressId: 2 })).shippingFee).toEqual(D(120));
      expect((await service.quote(7, {})).shippingFee).toBeNull();
    });

    it('ships free at the threshold', async () => {
      mockCartsService.getCart.mockResolvedValueOnce(
        cart([cartItem({ subtotal: D(FREE_SHIPPING_THRESHOLD) })]),
      );
      mockPrisma.address.findFirst.mockResolvedValueOnce({ city: 'Sylhet' });

      const quote = await service.quote(7, { addressId: 2 });

      expect(quote.shippingFee).toEqual(D(0));
      expect(quote.amountToFreeShipping).toEqual(D(0));
    });

    it('reports a bad coupon inline instead of failing', async () => {
      mockCartsService.getCart.mockResolvedValueOnce(cart());
      mockCouponsService.evaluate.mockRejectedValueOnce(
        new BadRequestException('This coupon has expired.'),
      );

      const quote = await service.quote(7, { couponCode: 'OLD' });

      expect(quote.couponError).toBe('This coupon has expired.');
      expect(quote.discountAmount).toEqual(D(0));
    });

    it('lists blocking cart problems', async () => {
      mockCartsService.getCart.mockResolvedValueOnce(
        cart([cartItem({ issue: 'INSUFFICIENT_STOCK', availableStock: 1 })], true),
      );

      const quote = await service.quote(7, {});

      expect(quote.problems).toEqual([
        'Only 1 left of "iPhone 17 Pro" (Black · 256GB) — lower the quantity to continue.',
      ]);
    });

    it("404s for someone else's address", async () => {
      mockCartsService.getCart.mockResolvedValueOnce(cart());
      mockPrisma.address.findFirst.mockResolvedValueOnce(null);

      await expect(service.quote(7, { addressId: 99 })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('placeOrder()', () => {
    const dto = { addressId: 1, paymentMethod: 'COD' as const };

    it('404s when the address does not belong to the user', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(null);

      await expect(service.placeOrder(7, dto)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('requires a reachable phone number', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce({
        ...address,
        phone: null,
        user: { name: 'N', phone: null },
      });

      await expect(service.placeOrder(7, dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses an empty cart', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(address);
      mockCartsService.getCart.mockResolvedValueOnce(cart([]));

      await expect(service.placeOrder(7, dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a cart with issues before opening a transaction', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(address);
      mockCartsService.getCart.mockResolvedValueOnce(
        cart([cartItem({ issue: 'OUT_OF_STOCK' })], true),
      );

      await expect(service.placeOrder(7, dto)).rejects.toBeInstanceOf(ConflictException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('decrements variant stock, re-syncs the product, records COD payment and clears the cart', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(address);
      mockCartsService.getCart.mockResolvedValueOnce(cart());
      stockRows();

      const order = await service.placeOrder(7, { ...dto, note: 'Call first' });

      expect(mockTx.productVariant.updateMany).toHaveBeenCalledWith({
        where: { id: 204, stockQuantity: { gte: 2 } },
        data: { stockQuantity: { decrement: 2 } },
      });
      expect(mockTx.product.update).toHaveBeenCalledWith({
        where: { id: 101 },
        data: { stockQuantity: 18 },
        select: { id: true },
      });
      const created = mockTx.order.create.mock.calls[0][0] as {
        data: Record<string, unknown> & { payment: unknown; items: { create: unknown[] } };
      };
      expect(created.data.totalAmount).toEqual(D(2460));
      expect(created.data.shippingFee).toEqual(D(60));
      expect(created.data.note).toBe('Call first');
      expect(created.data.payment).toEqual({ create: { provider: 'COD', amount: D(2460) } });
      expect(created.data.items.create).toEqual([
        { productId: 101, variantId: 204, quantity: 2, unitPrice: D(1200) },
      ]);
      expect(created.data.shippingAddress).toEqual(
        expect.objectContaining({ recipientName: 'Nusrat Jahan', phone: '01711000000' }),
      );
      expect(mockCartsService.clearCart).toHaveBeenCalledWith({ type: 'user', id: 7 });
      expect(order.items[0]?.variantLabel).toBe('Black · 256GB');
      expect(order.nextStatuses).toEqual(['PROCESSING', 'CANCELLED']);
    });

    it('falls back to the account name and phone for older addresses', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce({
        ...address,
        recipientName: null,
        phone: null,
      });
      mockCartsService.getCart.mockResolvedValueOnce(cart());
      stockRows();

      await service.placeOrder(7, dto);

      const created = mockTx.order.create.mock.calls[0][0] as {
        data: { shippingAddress: { recipientName: string; phone: string } };
      };
      expect(created.data.shippingAddress.recipientName).toBe('Nusrat');
      expect(created.data.shippingAddress.phone).toBe('01800000000');
    });

    it('applies and consumes the coupon against the re-priced subtotal', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(address);
      mockCartsService.getCart.mockResolvedValueOnce(cart());
      stockRows();
      mockCouponsService.evaluate.mockResolvedValueOnce({
        code: 'FLASH20',
        discountAmount: D(480),
      });

      await service.placeOrder(7, { ...dto, couponCode: 'flash20' });

      expect(mockCouponsService.evaluate).toHaveBeenCalledWith('flash20', D(2400));
      expect(mockTx.$executeRaw).toHaveBeenCalled();
      const created = mockTx.order.create.mock.calls[0][0] as { data: Record<string, unknown> };
      expect(created.data.couponCode).toBe('FLASH20');
      expect(created.data.discountAmount).toEqual(D(480));
      expect(created.data.totalAmount).toEqual(D(1980));
    });

    it('409s when the coupon limit is reached by a concurrent checkout', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(address);
      mockCartsService.getCart.mockResolvedValueOnce(cart());
      stockRows();
      mockCouponsService.evaluate.mockResolvedValueOnce({ code: 'FLASH20', discountAmount: D(1) });
      mockTx.$executeRaw.mockResolvedValueOnce(0);

      await expect(service.placeOrder(7, { ...dto, couponCode: 'FLASH20' })).rejects.toThrow(
        new ConflictException('This coupon just reached its usage limit.'),
      );
      expect(mockTx.order.create).not.toHaveBeenCalled();
    });

    it('409s with every problem when fresh stock is short', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(address);
      mockCartsService.getCart.mockResolvedValueOnce(cart());
      stockRows(1);

      await expect(service.placeOrder(7, dto)).rejects.toBeInstanceOf(ConflictException);
      expect(mockTx.productVariant.updateMany).not.toHaveBeenCalled();
    });

    it('409s when the atomic decrement loses a stock race', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(address);
      mockCartsService.getCart.mockResolvedValueOnce(cart());
      stockRows();
      mockTx.productVariant.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.placeOrder(7, dto)).rejects.toBeInstanceOf(ConflictException);
      expect(mockTx.order.create).not.toHaveBeenCalled();
    });

    it('still returns the order when clearing the cart fails', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(address);
      mockCartsService.getCart.mockResolvedValueOnce(cart());
      stockRows();
      mockCartsService.clearCart.mockRejectedValueOnce(new Error('redis down'));

      await expect(service.placeOrder(7, dto)).resolves.toEqual(
        expect.objectContaining({ id: 301 }),
      );
    });
  });

  describe('findAll()', () => {
    beforeEach(() => {
      mockPrisma.order.findMany.mockResolvedValue([orderRow]);
      mockPrisma.order.count.mockResolvedValue(1);
      mockPrisma.order.groupBy.mockResolvedValue([{ status: 'PENDING', _count: { _all: 4 } }]);
    });

    it('scopes a plain USER to their own orders and ignores search/userId', async () => {
      await service.findAll(customer, {
        page: 1,
        limit: 20,
        sortOrder: 'desc',
        userId: 99,
        search: 'x',
      });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 7 } }),
      );
    });

    it('lets staff search by order number', async () => {
      await service.findAll(admin, { page: 1, limit: 20, sortOrder: 'desc', search: '#301' });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { OR: [{ id: 301 }] } }),
      );
    });

    it('lets staff search customers by name, email or phone', async () => {
      await service.findAll(admin, { page: 1, limit: 20, sortOrder: 'desc', search: 'nusrat' });

      const where = (mockPrisma.order.findMany.mock.calls[0][0] as { where: { OR: unknown[] } })
        .where;
      expect(where.OR).toHaveLength(3);
    });

    it('counts every status for the tabs, ignoring the status filter', async () => {
      const result = await service.findAll(admin, {
        page: 1,
        limit: 20,
        sortOrder: 'desc',
        status: 'SHIPPED',
      });

      expect(mockPrisma.order.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'SHIPPED' } }),
      );
      expect(result.statusCounts).toHaveLength(6);
      expect(result.statusCounts.find((c) => c.status === 'PENDING')?.count).toBe(4);
      expect(result.statusCounts.find((c) => c.status === 'DELIVERED')?.count).toBe(0);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('findOne()', () => {
    it('scopes the lookup to the caller for a plain USER', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(orderRow);

      await service.findOne(customer, 301);

      expect(mockPrisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 301, userId: 7 } }),
      );
    });

    it('maps subtotal, item count and customer', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(orderRow);

      const order = await service.findOne(admin, 301);

      expect(order.subtotal).toEqual(D(2400));
      expect(order.itemCount).toBe(2);
      expect(order.customer?.email).toBe('a@b.com');
      expect(order.items[0]?.sku).toBe('IPH17-BLK-256');
    });

    it('404s when missing', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(null);

      await expect(service.findOne(customer, 1)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('cancel()', () => {
    it('refuses once the order is being prepared', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce({ status: 'PROCESSING' });

      await expect(service.cancel(customer, 301)).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('restocks, releases the coupon and returns the cancelled order', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce({ status: 'PENDING' });
      mockTx.order.updateMany.mockResolvedValueOnce({ count: 1 });
      mockTx.order.findUniqueOrThrow
        .mockResolvedValueOnce({
          couponCode: 'FLASH20',
          paymentStatus: 'UNPAID',
          payment: { provider: 'COD' },
          items: [{ productId: 101, variantId: 204, quantity: 2 }],
        })
        .mockResolvedValueOnce({ ...orderRow, status: 'CANCELLED' });

      const order = await service.cancel(customer, 301);

      expect(mockTx.order.updateMany).toHaveBeenCalledWith({
        where: { id: 301, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      expect(mockTx.productVariant.updateMany).toHaveBeenCalledWith({
        where: { id: 204 },
        data: { stockQuantity: { increment: 2 } },
      });
      expect(mockTx.product.update).toHaveBeenCalled(); // product re-synced to its variants
      expect(mockTx.$executeRaw).toHaveBeenCalled(); // coupon released
      expect(order.status).toBe('CANCELLED');
      expect(order.nextStatuses).toEqual([]);
    });

    it('409s when the order changed concurrently', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce({ status: 'PENDING' });
      mockTx.order.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.cancel(customer, 301)).rejects.toBeInstanceOf(ConflictException);
      expect(mockTx.productVariant.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus()', () => {
    it('refuses transitions outside the lifecycle map', async () => {
      mockPrisma.order.findUniqueOrThrow.mockResolvedValueOnce({ status: 'DELIVERED' });

      await expect(service.updateStatus(301, { status: 'PENDING' })).rejects.toThrow(
        new BadRequestException("An order can't move from delivered to pending."),
      );
    });

    it('refuses a no-op change', async () => {
      mockPrisma.order.findUniqueOrThrow.mockResolvedValueOnce({ status: 'SHIPPED' });

      await expect(service.updateStatus(301, { status: 'SHIPPED' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('marks cash-on-delivery orders paid when delivered, without restocking', async () => {
      mockPrisma.order.findUniqueOrThrow.mockResolvedValueOnce({ status: 'SHIPPED' });
      mockTx.order.updateMany.mockResolvedValueOnce({ count: 1 });
      mockTx.order.findUniqueOrThrow
        .mockResolvedValueOnce({
          couponCode: null,
          paymentStatus: 'UNPAID',
          payment: { provider: 'COD' },
          items: [{ productId: 101, variantId: null, quantity: 1 }],
        })
        .mockResolvedValueOnce({ ...orderRow, status: 'DELIVERED', paymentStatus: 'PAID' });

      await service.updateStatus(301, { status: 'DELIVERED' });

      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 301 },
        data: { paymentStatus: 'PAID' },
        select: { id: true },
      });
      expect(mockTx.payment.update).toHaveBeenCalledWith({
        where: { orderId: 301 },
        data: { status: 'PAID' },
        select: { id: true },
      });
      expect(mockTx.product.updateMany).not.toHaveBeenCalled();
    });

    it('refunds a paid order that is cancelled during processing', async () => {
      mockPrisma.order.findUniqueOrThrow.mockResolvedValueOnce({ status: 'PROCESSING' });
      mockTx.order.updateMany.mockResolvedValueOnce({ count: 1 });
      mockTx.order.findUniqueOrThrow
        .mockResolvedValueOnce({
          couponCode: null,
          paymentStatus: 'PAID',
          payment: { provider: 'BKASH' },
          items: [{ productId: 101, variantId: null, quantity: 1 }],
        })
        .mockResolvedValueOnce({ ...orderRow, status: 'CANCELLED' });

      await service.updateStatus(301, { status: 'CANCELLED' });

      expect(mockTx.product.updateMany).toHaveBeenCalledWith({
        where: { id: 101 },
        data: { stockQuantity: { increment: 1 } },
      });
      expect(mockTx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { paymentStatus: 'REFUNDED' } }),
      );
    });
  });

  it('keeps terminal statuses terminal', () => {
    expect(ORDER_TRANSITIONS.CANCELLED).toEqual([]);
    expect(ORDER_TRANSITIONS.RETURNED).toEqual([]);
  });
});
