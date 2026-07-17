import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { CartsService } from './carts.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { MAX_CART_ITEM_QUANTITY } from './carts.constants';
import type { CartIdentity } from './interfaces/cart-identity.interface';

const mockRedisClient = {
  hgetall: jest.fn(),
  hincrby: jest.fn(),
  hset: jest.fn(),
  hdel: jest.fn(),
  hexists: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
};

const mockPrisma = {
  product: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

const userIdentity: CartIdentity = { type: 'user', id: 7 };
const sessionIdentity: CartIdentity = { type: 'session', id: 'guest-abc' };

const sampleProductRow = {
  id: 101,
  name: 'iPhone 17 Pro',
  slug: 'iphone-17-pro',
  basePrice: new Prisma.Decimal(999),
  discountPrice: null,
  images: [{ url: 'https://cdn.example.com/1.jpg' }],
};

describe('CartsService', () => {
  let service: CartsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: { client: mockRedisClient } },
      ],
    }).compile();

    service = module.get<CartsService>(CartsService);
    jest.clearAllMocks();
  });

  describe('getCart()', () => {
    it('reads from the user-scoped Redis key and returns an empty cart when the hash is empty', async () => {
      mockRedisClient.hgetall.mockResolvedValueOnce({});

      const result = await service.getCart(userIdentity);

      expect(mockRedisClient.hgetall).toHaveBeenCalledWith('cart:user:7');
      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
      expect(result.totalPrice.toString()).toBe('0');
    });

    it('reads from the session-scoped Redis key for guests', async () => {
      mockRedisClient.hgetall.mockResolvedValueOnce({});

      await service.getCart(sessionIdentity);

      expect(mockRedisClient.hgetall).toHaveBeenCalledWith('cart:session:guest-abc');
    });

    it('enriches hash entries with product data and computes totals', async () => {
      mockRedisClient.hgetall.mockResolvedValueOnce({ '101': '2' });
      mockPrisma.product.findMany.mockResolvedValueOnce([sampleProductRow]);

      const result = await service.getCart(userIdentity);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({ productId: 101, quantity: 2 });
      expect(result.items[0]?.subtotal.toString()).toBe('1998');
      expect(result.totalItems).toBe(2);
      expect(result.totalPrice.toString()).toBe('1998');
      expect(mockRedisClient.hdel).not.toHaveBeenCalled();
    });

    it('uses discountPrice over basePrice when computing unitPrice', async () => {
      mockRedisClient.hgetall.mockResolvedValueOnce({ '101': '1' });
      mockPrisma.product.findMany.mockResolvedValueOnce([
        { ...sampleProductRow, discountPrice: new Prisma.Decimal(799) },
      ]);

      const result = await service.getCart(userIdentity);

      expect(result.items[0]?.unitPrice.toString()).toBe('799');
    });

    it('self-heals by removing hash fields that no longer match a product', async () => {
      mockRedisClient.hgetall.mockResolvedValueOnce({ '101': '1', '999': '3' });
      mockPrisma.product.findMany.mockResolvedValueOnce([sampleProductRow]);

      const result = await service.getCart(userIdentity);

      expect(mockRedisClient.hdel).toHaveBeenCalledWith('cart:user:7', '999');
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.productId).toBe(101);
    });
  });

  describe('addItem()', () => {
    it('throws NotFoundException when the product does not exist or is unpublished', async () => {
      mockPrisma.product.findFirst.mockResolvedValueOnce(null);

      await expect(service.addItem(userIdentity, { productId: 999, quantity: 1 })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRedisClient.hincrby).not.toHaveBeenCalled();
    });

    it('increments the quantity atomically and refreshes the TTL', async () => {
      mockPrisma.product.findFirst.mockResolvedValueOnce({ id: 101 });
      mockRedisClient.hincrby.mockResolvedValueOnce(2);
      mockRedisClient.hgetall.mockResolvedValueOnce({ '101': '2' });
      mockPrisma.product.findMany.mockResolvedValueOnce([sampleProductRow]);

      await service.addItem(userIdentity, { productId: 101, quantity: 2 });

      expect(mockRedisClient.hincrby).toHaveBeenCalledWith('cart:user:7', '101', 2);
      expect(mockRedisClient.expire).toHaveBeenCalledWith('cart:user:7', expect.any(Number));
      expect(mockRedisClient.hset).not.toHaveBeenCalled();
    });

    it('clamps the quantity down when the increment exceeds the max', async () => {
      mockPrisma.product.findFirst.mockResolvedValueOnce({ id: 101 });
      mockRedisClient.hincrby.mockResolvedValueOnce(MAX_CART_ITEM_QUANTITY + 5);
      mockRedisClient.hgetall.mockResolvedValueOnce({ '101': String(MAX_CART_ITEM_QUANTITY) });
      mockPrisma.product.findMany.mockResolvedValueOnce([sampleProductRow]);

      await service.addItem(userIdentity, { productId: 101, quantity: 50 });

      expect(mockRedisClient.hset).toHaveBeenCalledWith(
        'cart:user:7',
        '101',
        String(MAX_CART_ITEM_QUANTITY),
      );
    });
  });

  describe('updateItemQuantity()', () => {
    it('throws NotFoundException when the product is not in the cart', async () => {
      mockPrisma.product.findFirst.mockResolvedValueOnce({ id: 101 });
      mockRedisClient.hexists.mockResolvedValueOnce(0);

      await expect(service.updateItemQuantity(userIdentity, 101, { quantity: 3 })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRedisClient.hset).not.toHaveBeenCalled();
    });

    it('overwrites the quantity and refreshes the TTL', async () => {
      mockPrisma.product.findFirst.mockResolvedValueOnce({ id: 101 });
      mockRedisClient.hexists.mockResolvedValueOnce(1);
      mockRedisClient.hgetall.mockResolvedValueOnce({ '101': '5' });
      mockPrisma.product.findMany.mockResolvedValueOnce([sampleProductRow]);

      await service.updateItemQuantity(userIdentity, 101, { quantity: 5 });

      expect(mockRedisClient.hset).toHaveBeenCalledWith('cart:user:7', '101', '5');
      expect(mockRedisClient.expire).toHaveBeenCalledWith('cart:user:7', expect.any(Number));
    });
  });

  describe('removeItem()', () => {
    it('throws NotFoundException when nothing was removed', async () => {
      mockRedisClient.hdel.mockResolvedValueOnce(0);

      await expect(service.removeItem(userIdentity, 101)).rejects.toThrow(NotFoundException);
    });

    it('removes the field and returns the refreshed cart', async () => {
      mockRedisClient.hdel.mockResolvedValueOnce(1);
      mockRedisClient.hgetall.mockResolvedValueOnce({});

      const result = await service.removeItem(userIdentity, 101);

      expect(mockRedisClient.hdel).toHaveBeenCalledWith('cart:user:7', '101');
      expect(result.items).toEqual([]);
    });
  });

  describe('clearCart()', () => {
    it('deletes the whole cart key', async () => {
      await service.clearCart(sessionIdentity);

      expect(mockRedisClient.del).toHaveBeenCalledWith('cart:session:guest-abc');
    });
  });
});
