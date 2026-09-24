import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { CartsService } from './carts.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { MAX_CART_ITEM_QUANTITY, cartLineKey, parseCartLineKey } from './carts.constants';
import { linePrice } from './cart-pricing';
import type { CartIdentity } from './interfaces/cart-identity.interface';

const mockRedisClient = {
  hgetall: jest.fn(),
  hget: jest.fn(),
  hmget: jest.fn(),
  hset: jest.fn(),
  hdel: jest.fn(),
  hexists: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
};

const mockPrisma = {
  product: { findFirst: jest.fn(), findMany: jest.fn() },
  productVariant: { findFirst: jest.fn(), findMany: jest.fn() },
};

const user: CartIdentity = { type: 'user', id: 7 };
const guest: CartIdentity = { type: 'session', id: 'guest-abc' };

const D = (value: number) => new Prisma.Decimal(value);

function productRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    name: 'iPhone 17 Pro',
    slug: 'iphone-17-pro',
    sku: 'IPH17',
    isPublished: true,
    stockQuantity: 10,
    basePrice: D(1000),
    discountPrice: null,
    images: [{ url: 'https://cdn.example.com/1.jpg' }],
    _count: { variants: 0 },
    ...overrides,
  };
}

function variantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 204,
    productId: 101,
    sku: 'IPH17-BLK-256',
    price: D(1200),
    stockQuantity: 4,
    imageUrl: null,
    options: [{ attributeOption: { value: 'Black' } }, { attributeOption: { value: '256GB' } }],
    ...overrides,
  };
}

describe('cart line keys', () => {
  it('round-trips simple and variant lines', () => {
    expect(cartLineKey(101, null)).toBe('101');
    expect(cartLineKey(101, 204)).toBe('101:204');
    expect(parseCartLineKey('101:204')).toEqual({ productId: 101, variantId: 204 });
    expect(parseCartLineKey('101')).toEqual({ productId: 101, variantId: null });
  });

  it('rejects anything else', () => {
    expect(parseCartLineKey('abc')).toBeNull();
    expect(parseCartLineKey('1:2:3')).toBeNull();
  });
});

describe('linePrice()', () => {
  it('charges the sale price and reports the base as the was-price', () => {
    expect(linePrice({ basePrice: D(1000), discountPrice: D(800) }, null)).toEqual({
      unitPrice: D(800),
      compareAtPrice: D(1000),
    });
  });

  it('applies the variant surcharge to the was-price when on sale', () => {
    // Selling 800 → variant 950 is a 150 surcharge, so it "was" 1150.
    const result = linePrice({ basePrice: D(1000), discountPrice: D(800) }, { price: D(950) });
    expect(result.unitPrice).toEqual(D(950));
    expect(result.compareAtPrice).toEqual(D(1150));
  });

  it('has no was-price when nothing is discounted', () => {
    expect(linePrice({ basePrice: D(1000), discountPrice: null }, { price: D(1200) })).toEqual({
      unitPrice: D(1200),
      compareAtPrice: null,
    });
  });
});

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
    it('returns an empty cart for an empty hash without touching the database', async () => {
      mockRedisClient.hgetall.mockResolvedValueOnce({});

      const result = await service.getCart(user);

      expect(mockRedisClient.hgetall).toHaveBeenCalledWith('cart:user:7');
      expect(result.items).toEqual([]);
      expect(result.totalPrice.toString()).toBe('0');
      expect(result.hasIssues).toBe(false);
      expect(mockPrisma.product.findMany).not.toHaveBeenCalled();
    });

    it('prices simple and variant lines, with labels and totals', async () => {
      mockRedisClient.hgetall.mockResolvedValueOnce({ '101:204': '2', '102': '1' });
      mockPrisma.product.findMany.mockResolvedValueOnce([
        productRow({ _count: { variants: 3 } }),
        productRow({ id: 102, name: 'Case', sku: 'CASE', basePrice: D(500) }),
      ]);
      mockPrisma.productVariant.findMany.mockResolvedValueOnce([variantRow()]);

      const result = await service.getCart(guest);

      expect(mockRedisClient.hgetall).toHaveBeenCalledWith('cart:session:guest-abc');
      expect(result.items.map((item) => [item.key, item.variantLabel, item.sku])).toEqual([
        ['101:204', 'Black · 256GB', 'IPH17-BLK-256'],
        ['102', null, 'CASE'],
      ]);
      expect(result.items[0]?.subtotal).toEqual(D(2400));
      expect(result.totalItems).toBe(3);
      expect(result.totalPrice).toEqual(D(2900));
      expect(result.hasIssues).toBe(false);
    });

    it('flags lines that cannot be bought as-is', async () => {
      mockRedisClient.hgetall.mockResolvedValueOnce({ '101': '12', '102': '1', '103': '1' });
      mockPrisma.product.findMany.mockResolvedValueOnce([
        productRow(),
        productRow({ id: 102, stockQuantity: 0 }),
        productRow({ id: 103, isPublished: false }),
      ]);

      const result = await service.getCart(user);

      expect(result.items.map((item) => item.issue)).toEqual([
        'INSUFFICIENT_STOCK',
        'OUT_OF_STOCK',
        'UNAVAILABLE',
      ]);
      expect(result.hasIssues).toBe(true);
    });

    it('drops lines whose product or variant no longer exists', async () => {
      mockRedisClient.hgetall.mockResolvedValueOnce({ '101': '1', '999': '1', '101:555': '1' });
      mockPrisma.product.findMany.mockResolvedValueOnce([productRow()]);
      mockPrisma.productVariant.findMany.mockResolvedValueOnce([]);

      const result = await service.getCart(user);

      expect(result.items).toHaveLength(1);
      expect(mockRedisClient.hdel).toHaveBeenCalledWith('cart:user:7', '999', '101:555');
    });
  });

  describe('addItem()', () => {
    beforeEach(() => {
      mockRedisClient.hgetall.mockResolvedValue({});
    });

    it('requires a variant for products that sell through variants', async () => {
      mockPrisma.product.findFirst.mockResolvedValueOnce({
        stockQuantity: 5,
        _count: { variants: 2 },
      });

      await expect(service.addItem(user, { productId: 101, quantity: 1 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects a variant that belongs to another product', async () => {
      mockPrisma.product.findFirst.mockResolvedValueOnce({
        stockQuantity: 5,
        _count: { variants: 2 },
      });
      mockPrisma.productVariant.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.addItem(user, { productId: 101, variantId: 9, quantity: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s for an unpublished product', async () => {
      mockPrisma.product.findFirst.mockResolvedValueOnce(null);

      await expect(service.addItem(user, { productId: 101, quantity: 1 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('stores the variant line, clamped to available stock', async () => {
      mockPrisma.product.findFirst.mockResolvedValueOnce({
        stockQuantity: 4,
        _count: { variants: 1 },
      });
      mockPrisma.productVariant.findFirst.mockResolvedValueOnce({ stockQuantity: 4 });
      mockRedisClient.hget.mockResolvedValueOnce('1');

      await service.addItem(user, { productId: 101, variantId: 204, quantity: 10 });

      expect(mockRedisClient.hset).toHaveBeenCalledWith('cart:user:7', '101:204', '4');
      expect(mockRedisClient.expire).toHaveBeenCalled();
    });

    it('never exceeds the per-line maximum', async () => {
      mockPrisma.product.findFirst.mockResolvedValueOnce({
        stockQuantity: 500,
        _count: { variants: 0 },
      });
      mockRedisClient.hget.mockResolvedValueOnce(String(MAX_CART_ITEM_QUANTITY - 1));

      await service.addItem(user, { productId: 101, quantity: 5 });

      expect(mockRedisClient.hset).toHaveBeenCalledWith(
        'cart:user:7',
        '101',
        String(MAX_CART_ITEM_QUANTITY),
      );
    });

    it('409s when the cart already holds every available unit', async () => {
      mockPrisma.product.findFirst.mockResolvedValueOnce({
        stockQuantity: 2,
        _count: { variants: 0 },
      });
      mockRedisClient.hget.mockResolvedValueOnce('2');

      await expect(service.addItem(user, { productId: 101, quantity: 1 })).rejects.toThrow(
        new ConflictException('You already have all 2 available in your cart.'),
      );
      expect(mockRedisClient.hset).not.toHaveBeenCalled();
    });

    it('409s for an out-of-stock item', async () => {
      mockPrisma.product.findFirst.mockResolvedValueOnce({
        stockQuantity: 0,
        _count: { variants: 0 },
      });
      mockRedisClient.hget.mockResolvedValueOnce(null);

      await expect(service.addItem(user, { productId: 101, quantity: 1 })).rejects.toThrow(
        new ConflictException('This item is out of stock.'),
      );
    });
  });

  describe('updateItemQuantity()', () => {
    it('rejects a malformed key', async () => {
      await expect(service.updateItemQuantity(user, 'x', { quantity: 1 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('404s when the line is not in the cart', async () => {
      mockRedisClient.hexists.mockResolvedValueOnce(0);

      await expect(service.updateItemQuantity(user, '101', { quantity: 1 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('refuses more than the stock allows', async () => {
      mockRedisClient.hexists.mockResolvedValueOnce(1);
      mockPrisma.product.findFirst.mockResolvedValueOnce({
        stockQuantity: 3,
        _count: { variants: 0 },
      });

      await expect(service.updateItemQuantity(user, '101', { quantity: 5 })).rejects.toThrow(
        new ConflictException('Only 3 left in stock.'),
      );
    });

    it('sets the exact quantity', async () => {
      mockRedisClient.hexists.mockResolvedValueOnce(1);
      mockPrisma.product.findFirst.mockResolvedValueOnce({
        stockQuantity: 3,
        _count: { variants: 1 },
      });
      mockPrisma.productVariant.findFirst.mockResolvedValueOnce({ stockQuantity: 9 });
      mockRedisClient.hgetall.mockResolvedValueOnce({});

      await service.updateItemQuantity(user, '101:204', { quantity: 5 });

      expect(mockRedisClient.hset).toHaveBeenCalledWith('cart:user:7', '101:204', '5');
    });
  });

  describe('removeItem()', () => {
    it('404s when nothing was removed', async () => {
      mockRedisClient.hdel.mockResolvedValueOnce(0);

      await expect(service.removeItem(user, '101')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('removes the line by key', async () => {
      mockRedisClient.hdel.mockResolvedValueOnce(1);
      mockRedisClient.hgetall.mockResolvedValueOnce({});

      await service.removeItem(user, '101:204');

      expect(mockRedisClient.hdel).toHaveBeenCalledWith('cart:user:7', '101:204');
    });
  });

  describe('mergeGuestCart()', () => {
    it('adds guest quantities onto the user cart, capped, then deletes the guest cart', async () => {
      mockRedisClient.hgetall
        .mockResolvedValueOnce({ '101': '2', '102:7': '99' })
        .mockResolvedValueOnce({});
      mockRedisClient.hmget.mockResolvedValueOnce(['1', '5']);

      await service.mergeGuestCart(7, 'guest-abc');

      expect(mockRedisClient.hset).toHaveBeenCalledWith(
        'cart:user:7',
        '101',
        '3',
        '102:7',
        String(MAX_CART_ITEM_QUANTITY),
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith('cart:session:guest-abc');
    });

    it('just deletes an empty guest cart', async () => {
      mockRedisClient.hgetall.mockResolvedValueOnce({}).mockResolvedValueOnce({});

      await service.mergeGuestCart(7, 'guest-abc');

      expect(mockRedisClient.hset).not.toHaveBeenCalled();
      expect(mockRedisClient.del).toHaveBeenCalledWith('cart:session:guest-abc');
    });
  });

  describe('clearCart()', () => {
    it('deletes the identity-scoped key', async () => {
      await service.clearCart(guest);

      expect(mockRedisClient.del).toHaveBeenCalledWith('cart:session:guest-abc');
    });
  });
});
