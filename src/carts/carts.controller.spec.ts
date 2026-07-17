import { Test, type TestingModule } from '@nestjs/testing';
import { CartsController } from './carts.controller';
import { CartsService } from './carts.service';
import { CartEntity } from './entities/cart.entity';
import type { CartIdentity } from './interfaces/cart-identity.interface';

const mockCartsService = {
  getCart: jest.fn(),
  addItem: jest.fn(),
  updateItemQuantity: jest.fn(),
  removeItem: jest.fn(),
  clearCart: jest.fn(),
};

const identity: CartIdentity = { type: 'user', id: 7 };

const sampleCart = new CartEntity({
  items: [],
  totalItems: 0,
  totalPrice: 0 as unknown as CartEntity['totalPrice'],
});

describe('CartsController', () => {
  let controller: CartsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartsController],
      providers: [{ provide: CartsService, useValue: mockCartsService }],
    }).compile();

    controller = module.get<CartsController>(CartsController);
    jest.clearAllMocks();
  });

  describe('getCart()', () => {
    it('delegates to the service with the resolved identity', async () => {
      mockCartsService.getCart.mockResolvedValueOnce(sampleCart);

      const result = await controller.getCart(identity);

      expect(mockCartsService.getCart).toHaveBeenCalledWith(identity);
      expect(result).toEqual({ message: 'Cart retrieved successfully', data: sampleCart });
    });
  });

  describe('addItem()', () => {
    it('delegates to the service with identity and dto', async () => {
      mockCartsService.addItem.mockResolvedValueOnce(sampleCart);
      const dto = { productId: 101, quantity: 2 };

      const result = await controller.addItem(identity, dto);

      expect(mockCartsService.addItem).toHaveBeenCalledWith(identity, dto);
      expect(result).toEqual({ message: 'Item added to cart successfully', data: sampleCart });
    });
  });

  describe('updateItemQuantity()', () => {
    it('delegates to the service with identity, productId, and dto', async () => {
      mockCartsService.updateItemQuantity.mockResolvedValueOnce(sampleCart);

      const result = await controller.updateItemQuantity(identity, 101, { quantity: 5 });

      expect(mockCartsService.updateItemQuantity).toHaveBeenCalledWith(identity, 101, {
        quantity: 5,
      });
      expect(result).toEqual({ message: 'Cart item updated successfully', data: sampleCart });
    });
  });

  describe('removeItem()', () => {
    it('delegates to the service with identity and productId', async () => {
      mockCartsService.removeItem.mockResolvedValueOnce(sampleCart);

      const result = await controller.removeItem(identity, 101);

      expect(mockCartsService.removeItem).toHaveBeenCalledWith(identity, 101);
      expect(result).toEqual({ message: 'Item removed from cart successfully', data: sampleCart });
    });
  });

  describe('clearCart()', () => {
    it('delegates to the service and returns a null-data envelope', async () => {
      mockCartsService.clearCart.mockResolvedValueOnce(undefined);

      const result = await controller.clearCart(identity);

      expect(mockCartsService.clearCart).toHaveBeenCalledWith(identity);
      expect(result).toEqual({ message: 'Cart cleared successfully', data: null });
    });
  });
});
