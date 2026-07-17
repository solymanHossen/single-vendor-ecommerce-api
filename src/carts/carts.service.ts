import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { CART_TTL_SECONDS, MAX_CART_ITEM_QUANTITY } from './carts.constants';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartEntity, CartItemEntity } from './entities/cart.entity';
import { CartIdentity } from './interfaces/cart-identity.interface';

const CART_PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  basePrice: true,
  discountPrice: true,
  images: { select: { url: true }, orderBy: { isThumbnail: 'desc' }, take: 1 },
} satisfies Prisma.ProductSelect;

type CartProductRow = Prisma.ProductGetPayload<{ select: typeof CART_PRODUCT_SELECT }>;

@Injectable()
export class CartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getCart(identity: CartIdentity): Promise<CartEntity> {
    const key = this.getCartKey(identity);
    const rawItems = await this.redis.client.hgetall(key);
    const entries = Object.entries(rawItems);

    if (entries.length === 0) {
      return new CartEntity({ items: [], totalItems: 0, totalPrice: new Prisma.Decimal(0) });
    }

    const productIds = entries.map(([productId]) => Number(productId));
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: CART_PRODUCT_SELECT,
    });
    const productById = new Map(products.map((product) => [product.id, product]));

    // Self-heals a cart that references a product deleted after being added
    // — without this, HGETALL would keep returning a phantom line item forever.
    const staleProductIds = productIds.filter((id) => !productById.has(id));
    if (staleProductIds.length > 0) {
      await this.redis.client.hdel(key, ...staleProductIds.map(String));
    }

    let totalItems = 0;
    let totalPrice = new Prisma.Decimal(0);
    const items: CartItemEntity[] = [];

    for (const [productIdRaw, quantityRaw] of entries) {
      const product = productById.get(Number(productIdRaw));
      if (!product) continue;

      const quantity = Number(quantityRaw);
      const item = this.toItemEntity(product, quantity);

      items.push(item);
      totalItems += quantity;
      totalPrice = totalPrice.plus(item.subtotal);
    }

    items.sort((a, b) => a.productId - b.productId);

    return new CartEntity({ items, totalItems, totalPrice });
  }

  async addItem(identity: CartIdentity, dto: AddCartItemDto): Promise<CartEntity> {
    await this.assertProductIsAvailable(dto.productId);

    const key = this.getCartKey(identity);
    const field = String(dto.productId);
    const newQuantity = await this.redis.client.hincrby(key, field, dto.quantity);

    if (newQuantity > MAX_CART_ITEM_QUANTITY) {
      await this.redis.client.hset(key, field, String(MAX_CART_ITEM_QUANTITY));
    }

    await this.redis.client.expire(key, CART_TTL_SECONDS);

    return this.getCart(identity);
  }

  async updateItemQuantity(
    identity: CartIdentity,
    productId: number,
    dto: UpdateCartItemDto,
  ): Promise<CartEntity> {
    await this.assertProductIsAvailable(productId);

    const key = this.getCartKey(identity);
    const field = String(productId);
    const exists = await this.redis.client.hexists(key, field);

    if (exists === 0) {
      throw new NotFoundException('Product is not in the cart.');
    }

    await this.redis.client.hset(key, field, String(dto.quantity));
    await this.redis.client.expire(key, CART_TTL_SECONDS);

    return this.getCart(identity);
  }

  async removeItem(identity: CartIdentity, productId: number): Promise<CartEntity> {
    const key = this.getCartKey(identity);
    const removed = await this.redis.client.hdel(key, String(productId));

    if (removed === 0) {
      throw new NotFoundException('Product is not in the cart.');
    }

    return this.getCart(identity);
  }

  async clearCart(identity: CartIdentity): Promise<void> {
    const key = this.getCartKey(identity);
    await this.redis.client.del(key);
  }

  private async assertProductIsAvailable(productId: number): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isPublished: true },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Product does not exist or is not available for purchase.');
    }
  }

  private getCartKey(identity: CartIdentity): string {
    return identity.type === 'user' ? `cart:user:${identity.id}` : `cart:session:${identity.id}`;
  }

  private toItemEntity(product: CartProductRow, quantity: number): CartItemEntity {
    const unitPrice = product.discountPrice ?? product.basePrice;

    return new CartItemEntity({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      imageUrl: product.images[0]?.url ?? null,
      unitPrice,
      quantity,
      subtotal: unitPrice.times(quantity),
    });
  }
}
