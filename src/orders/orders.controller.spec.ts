import { Test, type TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import {
  OrderEntity,
  OrderItemEntity,
  OrderItemProductSummaryEntity,
  PaginatedOrdersEntity,
  ShippingAddressEntity,
} from './entities/order.entity';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockOrdersService = {
  placeOrder: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  updateStatus: jest.fn(),
};

const currentUser: AuthUser = { id: 7, email: 'a@b.com', role: Role.USER, isActive: true };

const sampleOrder = new OrderEntity({
  id: 301,
  userId: 7,
  status: 'PENDING',
  paymentStatus: 'UNPAID',
  totalAmount: 1998 as unknown as OrderEntity['totalAmount'],
  discountAmount: 0 as unknown as OrderEntity['discountAmount'],
  shippingFee: 0 as unknown as OrderEntity['shippingFee'],
  shippingAddress: new ShippingAddressEntity({
    addressLine1: '123 Main St',
    addressLine2: null,
    city: 'Springfield',
    state: 'IL',
    postalCode: '62704',
    country: 'USA',
  }),
  items: [
    new OrderItemEntity({
      id: 501,
      productId: 101,
      product: new OrderItemProductSummaryEntity({
        id: 101,
        name: 'iPhone 17 Pro',
        slug: 'iphone-17-pro',
        imageUrl: null,
      }),
      quantity: 2,
      unitPrice: 999 as unknown as OrderItemEntity['unitPrice'],
      subtotal: 1998 as unknown as OrderItemEntity['subtotal'],
    }),
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('OrdersController', () => {
  let controller: OrdersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mockOrdersService }],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    jest.clearAllMocks();
  });

  describe('placeOrder()', () => {
    it("delegates to the service with the current user's id and dto", async () => {
      mockOrdersService.placeOrder.mockResolvedValueOnce(sampleOrder);

      const result = await controller.placeOrder(currentUser, { addressId: 1 });

      expect(mockOrdersService.placeOrder).toHaveBeenCalledWith(7, { addressId: 1 });
      expect(result).toEqual({ message: 'Order placed successfully', data: sampleOrder });
    });
  });

  describe('findAll()', () => {
    it('delegates to the service with the current user and query', async () => {
      const paginated = new PaginatedOrdersEntity({
        items: [sampleOrder],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
      mockOrdersService.findAll.mockResolvedValueOnce(paginated);
      const query = { page: 1, limit: 20, sortOrder: 'desc' as const };

      const result = await controller.findAll(currentUser, query);

      expect(mockOrdersService.findAll).toHaveBeenCalledWith(currentUser, query);
      expect(result).toEqual({ message: 'Orders retrieved successfully', data: paginated });
    });
  });

  describe('findOne()', () => {
    it('delegates to the service with the current user and id', async () => {
      mockOrdersService.findOne.mockResolvedValueOnce(sampleOrder);

      const result = await controller.findOne(currentUser, 301);

      expect(mockOrdersService.findOne).toHaveBeenCalledWith(currentUser, 301);
      expect(result).toEqual({ message: 'Order retrieved successfully', data: sampleOrder });
    });
  });

  describe('updateStatus()', () => {
    it('delegates to the service with id and dto', async () => {
      mockOrdersService.updateStatus.mockResolvedValueOnce({ ...sampleOrder, status: 'SHIPPED' });

      const result = await controller.updateStatus(301, { status: 'SHIPPED' });

      expect(mockOrdersService.updateStatus).toHaveBeenCalledWith(301, { status: 'SHIPPED' });
      expect(result).toEqual({
        message: 'Order status updated successfully',
        data: { ...sampleOrder, status: 'SHIPPED' },
      });
    });
  });
});
