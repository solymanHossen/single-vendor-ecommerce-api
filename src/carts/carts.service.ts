import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { linePrice, variantLabel } from './cart-pricing';
import {
  CART_TTL_SECONDS,
  MAX_CART_ITEM_QUANTITY,
  cartLineKey,
  parseCartLineKey,
} from './carts.constants';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartEntity, CartItemEntity, type CartLineIssue } from './entities/cart.entity';
import { CartIdentity } from './interfaces/cart-identity.interface';

const CART_PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  isPublished: true,
  stockQuantity: true,
  basePrice: true,
  discountPrice: true,
  images: {
    select: { url: true },
    orderBy: [{ isThumbnail: 'desc' }, { id: 'asc' }],
    take: 1,
  },
  _count: { select: { variants: true } },
} satisfies Prisma.ProductSelect;

const CART_VARIANT_SELECT = {
  id: true,
  productId: true,
  sku: true,
  price: true,
  stockQuantity: true,
  imageUrl: true,
  options: {
    select: { attributeOption: { select: { value: true } } },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.ProductVariantSelect;

type CartProductRow = Prisma.ProductGetPayload<{ select: typeof CART_PRODUCT_SELECT }>;
type CartVariantRow = Prisma.ProductVariantGetPayload<{ select: typeof CART_VARIANT_SELECT }>;

interface Purchasable {
  availableStock: number;
}

@Injectable()
export class CartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getCart(identity: CartIdentity): Promise<CartEntity> {
    const key = this.getCartKey(identity);
    const raw = await this.redis.client.hgetall(key);

    const lines = Object.entries(raw).flatMap(([field, quantity]) => {
      const parsed = parseCartLineKey(field);
      return parsed ? [{ field, ...parsed, quantity: Number(quantity) }] : [];
    });
    const malformed = Object.keys(raw).filter((field) => !parseCartLineKey(field));

    if (lines.length === 0) {
      if (malformed.length > 0) await this.redis.client.hdel(key, ...malformed);
      return new CartEntity({
        items: [],
        totalItems: 0,
        totalPrice: new Prisma.Decimal(0),
        hasIssues: false,
      });
    }

    const productIds = [...new Set(lines.map((line) => line.productId))];
    const variantIds = lines.flatMap((line) => (line.variantId === null ? [] : [line.variantId]));
    const [products, variants] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: CART_PRODUCT_SELECT,
      }),
      variantIds.length > 0
        ? this.prisma.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: CART_VARIANT_SELECT,
          })
        : Promise.resolve([]),
    ]);
    const productById = new Map(products.map((product) => [product.id, product]));
    const variantById = new Map(variants.map((variant) => [variant.id, variant]));

    // Self-heal: drop lines whose product/variant was deleted (or no longer
    // matches) so the hash never returns phantom items.
    const stale: string[] = [...malformed];
    const items: CartItemEntity[] = [];
    for (const line of lines) {
      const product = productById.get(line.productId);
      const variant = line.variantId === null ? null : variantById.get(line.variantId);
      if (!product || variant === undefined || (variant && variant.productId !== product.id)) {
        stale.push(line.field);
        continue;
      }
      items.push(this.toItemEntity(product, variant, line.quantity));
    }
    if (stale.length > 0) await this.redis.client.hdel(key, ...stale);

    items.sort((a, b) => a.productId - b.productId || (a.variantId ?? 0) - (b.variantId ?? 0));

    return new CartEntity({
      items,
      totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
      totalPrice: items.reduce((sum, item) => sum.plus(item.subtotal), new Prisma.Decimal(0)),
      hasIssues: items.some((item) => item.issue !== null),
    });
  }

  async addItem(identity: CartIdentity, dto: AddCartItemDto): Promise<CartEntity> {
    const variantId = dto.variantId ?? null;
    const { availableStock } = await this.assertPurchasable(dto.productId, variantId);

    const key = this.getCartKey(identity);
    const field = cartLineKey(dto.productId, variantId);
    const current = Number((await this.redis.client.hget(key, field)) ?? 0);
    const limit = Math.min(availableStock, MAX_CART_ITEM_QUANTITY);

    if (current >= limit) {
      throw new ConflictException(
        current > 0
          ? `You already have all ${limit} available in your cart.`
          : 'This item is out of stock.',
      );
    }

    // Clamp rather than refuse: adding 5 when 3 are left adds 3.
    await this.redis.client.hset(key, field, String(Math.min(current + dto.quantity, limit)));
    await this.redis.client.expire(key, CART_TTL_SECONDS);

    return this.getCart(identity);
  }

  async updateItemQuantity(
    identity: CartIdentity,
    lineKey: string,
    dto: UpdateCartItemDto,
  ): Promise<CartEntity> {
    const line = this.parseKey(lineKey);
    const key = this.getCartKey(identity);
    if ((await this.redis.client.hexists(key, lineKey)) === 0) {
      throw new NotFoundException('This item is not in the cart.');
    }

    const { availableStock } = await this.assertPurchasable(line.productId, line.variantId);
    if (dto.quantity > availableStock) {
      throw new ConflictException(
        availableStock === 0
          ? 'This item is out of stock.'
          : `Only ${availableStock} left in stock.`,
      );
    }

    await this.redis.client.hset(key, lineKey, String(dto.quantity));
    await this.redis.client.expire(key, CART_TTL_SECONDS);

    return this.getCart(identity);
  }

  async removeItem(identity: CartIdentity, lineKey: string): Promise<CartEntity> {
    this.parseKey(lineKey);
    const removed = await this.redis.client.hdel(this.getCartKey(identity), lineKey);
    if (removed === 0) {
      throw new NotFoundException('This item is not in the cart.');
    }
    return this.getCart(identity);
  }

  async clearCart(identity: CartIdentity): Promise<void> {
    await this.redis.client.del(this.getCartKey(identity));
  }

  /**
   * Folds a guest cart into the signed-in user's cart (quantities add up,
   * capped) and deletes the guest cart, so nothing is lost at sign-in.
   */
  async mergeGuestCart(userId: number, sessionId: string): Promise<CartEntity> {
    const guestKey = this.getCartKey({ type: 'session', id: sessionId });
    const userKey = this.getCartKey({ type: 'user', id: userId });
    const guest = await this.redis.client.hgetall(guestKey);

    const fields = Object.entries(guest).filter(([field]) => parseCartLineKey(field));
    if (fields.length > 0) {
      const existing = await this.redis.client.hmget(userKey, ...fields.map(([field]) => field));
      const merged = fields.flatMap(([field, quantity], index) => [
        field,
        String(Math.min(Number(existing[index] ?? 0) + Number(quantity), MAX_CART_ITEM_QUANTITY)),
      ]);
      await this.redis.client.hset(userKey, ...merged);
      await this.redis.client.expire(userKey, CART_TTL_SECONDS);
    }
    await this.redis.client.del(guestKey);

    return this.getCart({ type: 'user', id: userId });
  }

  private parseKey(lineKey: string): { productId: number; variantId: number | null } {
    const parsed = parseCartLineKey(lineKey);
    if (!parsed) throw new BadRequestException('Invalid cart item key.');
    return parsed;
  }

  private async assertPurchasable(
    productId: number,
    variantId: number | null,
  ): Promise<Purchasable> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isPublished: true },
      select: { stockQuantity: true, _count: { select: { variants: true } } },
    });
    if (!product) {
      throw new NotFoundException('Product does not exist or is not available for purchase.');
    }

    const hasVariants = product._count.variants > 0;
    if (hasVariants && variantId === null) {
      throw new BadRequestException(
        'Choose an option (like size or colour) before adding this item.',
      );
    }
    if (!hasVariants && variantId !== null) {
      throw new BadRequestException('This product has no options to choose from.');
    }
    if (variantId === null) return { availableStock: product.stockQuantity };

    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
      select: { stockQuantity: true },
    });
    if (!variant) {
      throw new NotFoundException('That option is no longer available.');
    }
    return { availableStock: variant.stockQuantity };
  }

  private getCartKey(identity: CartIdentity): string {
    return identity.type === 'user' ? `cart:user:${identity.id}` : `cart:session:${identity.id}`;
  }

  private toItemEntity(
    product: CartProductRow,
    variant: CartVariantRow | null,
    quantity: number,
  ): CartItemEntity {
    const { unitPrice, compareAtPrice } = linePrice(product, variant);
    const availableStock = variant ? variant.stockQuantity : product.stockQuantity;

    let issue: CartLineIssue | null = null;
    // A product that gained variants after this simple line was added can
    // no longer be bought without choosing one.
    if (!product.isPublished || (!variant && product._count.variants > 0)) issue = 'UNAVAILABLE';
    else if (availableStock === 0) issue = 'OUT_OF_STOCK';
    else if (quantity > availableStock) issue = 'INSUFFICIENT_STOCK';

    return new CartItemEntity({
      key: cartLineKey(product.id, variant?.id ?? null),
      productId: product.id,
      variantId: variant?.id ?? null,
      name: product.name,
      slug: product.slug,
      imageUrl: variant?.imageUrl ?? product.images[0]?.url ?? null,
      variantLabel: variant
        ? variantLabel(variant.options.map((option) => option.attributeOption))
        : null,
      sku: variant?.sku ?? product.sku,
      unitPrice,
      compareAtPrice,
      quantity,
      subtotal: unitPrice.times(quantity),
      availableStock,
      issue,
    });
  }
}
