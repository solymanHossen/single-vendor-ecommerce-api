import { Test, type TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PlaceOrderSchema } from './dto/place-order.dto';
import { QuoteOrderSchema } from './dto/quote-order.dto';
import type { OrderEntity, OrderQuoteEntity, PaginatedOrdersEntity } from './entities/order.entity';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockOrdersService = {
  quote: jest.fn(),
  placeOrder: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  cancel: jest.fn(),
  updateStatus: jest.fn(),
};

const currentUser: AuthUser = { id: 7, email: 'a@b.com', role: Role.USER, isActive: true };

// The controller only forwards service results, so opaque stand-ins suffice.
const sampleOrder = { id: 301, status: 'PENDING' } as unknown as OrderEntity;

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

  it("quote() prices the caller's cart", async () => {
    const quote = { totalAmount: '100.00' } as unknown as OrderQuoteEntity;
    mockOrdersService.quote.mockResolvedValueOnce(quote);

    const result = await controller.quote(currentUser, { addressId: 1, couponCode: 'X' });

    expect(mockOrdersService.quote).toHaveBeenCalledWith(7, { addressId: 1, couponCode: 'X' });
    expect(result).toEqual({ message: 'Quote calculated successfully', data: quote });
  });

  it("placeOrder() delegates with the current user's id and dto", async () => {
    mockOrdersService.placeOrder.mockResolvedValueOnce(sampleOrder);
    const dto = PlaceOrderSchema.parse({ addressId: 1 });

    const result = await controller.placeOrder(currentUser, dto);

    expect(mockOrdersService.placeOrder).toHaveBeenCalledWith(7, {
      addressId: 1,
      paymentMethod: 'COD',
    });
    expect(result).toEqual({ message: 'Order placed successfully', data: sampleOrder });
  });

  it('findAll() delegates with the current user and query', async () => {
    const page = { items: [sampleOrder] } as unknown as PaginatedOrdersEntity;
    mockOrdersService.findAll.mockResolvedValueOnce(page);
    const query = { page: 1, limit: 20, sortOrder: 'desc' as const };

    const result = await controller.findAll(currentUser, query);

    expect(mockOrdersService.findAll).toHaveBeenCalledWith(currentUser, query);
    expect(result).toEqual({ message: 'Orders retrieved successfully', data: page });
  });

  it('findOne() delegates with the current user and id', async () => {
    mockOrdersService.findOne.mockResolvedValueOnce(sampleOrder);

    const result = await controller.findOne(currentUser, 301);

    expect(mockOrdersService.findOne).toHaveBeenCalledWith(currentUser, 301);
    expect(result).toEqual({ message: 'Order retrieved successfully', data: sampleOrder });
  });

  it('cancel() delegates with the current user and id', async () => {
    mockOrdersService.cancel.mockResolvedValueOnce(sampleOrder);

    const result = await controller.cancel(currentUser, 301);

    expect(mockOrdersService.cancel).toHaveBeenCalledWith(currentUser, 301);
    expect(result).toEqual({ message: 'Order cancelled successfully', data: sampleOrder });
  });

  it('updateStatus() delegates with id and dto', async () => {
    mockOrdersService.updateStatus.mockResolvedValueOnce(sampleOrder);

    await controller.updateStatus(301, { status: 'SHIPPED' });

    expect(mockOrdersService.updateStatus).toHaveBeenCalledWith(301, { status: 'SHIPPED' });
  });

  describe('DTOs', () => {
    it('only accepts cash on delivery for now', () => {
      expect(PlaceOrderSchema.safeParse({ addressId: 1, paymentMethod: 'BKASH' }).success).toBe(
        false,
      );
    });

    it('caps the delivery note at 500 characters', () => {
      expect(PlaceOrderSchema.safeParse({ addressId: 1, note: 'x'.repeat(501) }).success).toBe(
        false,
      );
    });

    it('lets a quote omit the address', () => {
      expect(QuoteOrderSchema.parse({})).toEqual({});
    });
  });
});
