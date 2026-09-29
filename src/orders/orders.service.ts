import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  StockMovementType,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CartsService } from '../carts/carts.service';
import { linePrice, variantLabel } from '../carts/cart-pricing';
import { InsufficientStockError, StockLedgerService } from '../inventory/stock-ledger.service';
import { CampaignPricingService } from '../campaigns/campaign-pricing.service';
import { applyCampaign } from '../campaigns/campaign-pricing';
import type { CartEntity } from '../carts/entities/cart.entity';
import type { CartIdentity } from '../carts/interfaces/cart-identity.interface';
import { CouponsService } from '../coupons/coupons.service';
import { SettingsService } from '../settings/settings.service';
import type { ShippingRules } from '../settings/interfaces/app-settings.interface';
import type { CouponValidationEntity } from '../coupons/entities/coupon.entity';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { PlaceOrderDto } from './dto/place-order.dto';
import { OrderQueryDto } from './dto/query-order.dto';
import { QuoteOrderDto } from './dto/quote-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import {
  CUSTOMER_CANCELLABLE_STATUSES,
  IN_PROGRESS_STATUSES,
  ORDER_STATUS_VALUES,
  ORDER_TRANSITIONS,
  RESTOCK_ON_CANCEL_STATUSES,
  isInsideDhaka,
} from './orders.constants';
import {
  OrderCustomerEntity,
  OrderEntity,
  OrderItemEntity,
  OrderItemProductSummaryEntity,
  OrderPaymentEntity,
  OrderQuoteEntity,
  OrderStatusCountEntity,
  OrderSummaryEntity,
  PaginatedOrdersEntity,
  PaginationMetaEntity,
  QuoteCouponEntity,
  ShippingAddressEntity,
  type ShippingAddressEntityInput,
} from './entities/order.entity';
import { hasPermission } from '../access/permissions.guard';

const ORDER_ITEM_SELECT = {
  id: true,
  productId: true,
  variantId: true,
  quantity: true,
  unitPrice: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      images: {
        select: { url: true },
        orderBy: [{ isThumbnail: 'desc' }, { id: 'asc' }],
        take: 1,
      },
    },
  },
  variant: {
    select: {
      sku: true,
      imageUrl: true,
      options: {
        select: { attributeOption: { select: { value: true } } },
        orderBy: { id: 'asc' },
      },
    },
  },
} satisfies Prisma.OrderItemSelect;

const ORDER_SELECT = {
  id: true,
  userId: true,
  user: { select: { id: true, name: true, email: true, phone: true } },
  status: true,
  paymentStatus: true,
  payment: { select: { provider: true, status: true, transactionId: true } },
  totalAmount: true,
  discountAmount: true,
  shippingFee: true,
  couponCode: true,
  note: true,
  shippingAddress: true,
  items: { select: ORDER_ITEM_SELECT, orderBy: { id: 'asc' } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrderSelect;

type OrderRow = Prisma.OrderGetPayload<{ select: typeof ORDER_SELECT }>;
type OrderItemRow = Prisma.OrderItemGetPayload<{ select: typeof ORDER_ITEM_SELECT }>;

interface CheckoutLine {
  productId: number;
  variantId: number | null;
  quantity: number;
}

interface PricedLine extends CheckoutLine {
  unitPrice: Prisma.Decimal;
  campaignId: number | null;
}

interface Totals {
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  shipping: Prisma.Decimal | null;
  total: Prisma.Decimal;
}

const ZERO = new Prisma.Decimal(0);

/** Delivery fee from the store's shipping settings; null until the city is known. */
function shippingFor(
  city: string | null,
  subtotal: Prisma.Decimal,
  rules: ShippingRules,
): Prisma.Decimal | null {
  if (city === null) return null;
  if (subtotal.greaterThanOrEqualTo(rules.freeShippingThreshold)) return ZERO;
  return new Prisma.Decimal(
    isInsideDhaka(city) ? rules.shippingFeeInsideDhaka : rules.shippingFeeOutsideDhaka,
  );
}

function totalsFor(
  subtotal: Prisma.Decimal,
  coupon: CouponValidationEntity | null,
  city: string | null,
  rules: ShippingRules,
): Totals {
  const discount = coupon?.discountAmount ?? ZERO;
  const shipping = coupon?.freeShipping ? ZERO : shippingFor(city, subtotal, rules);
  return {
    subtotal,
    discount,
    shipping,
    total: subtotal.minus(discount).plus(shipping ?? ZERO),
  };
}

/** Shopper-facing sentence for a cart line that blocks checkout. */
function cartProblems(cart: CartEntity): string[] {
  return cart.items.flatMap((item) => {
    const name = item.variantLabel ? `"${item.name}" (${item.variantLabel})` : `"${item.name}"`;
    switch (item.issue) {
      case 'UNAVAILABLE':
        return [`${name} is no longer available — remove it to continue.`];
      case 'OUT_OF_STOCK':
        return [`${name} just sold out — remove it to continue.`];
      case 'INSUFFICIENT_STOCK':
        return [`Only ${item.availableStock} left of ${name} — lower the quantity to continue.`];
      default:
        return [];
    }
  });
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cartsService: CartsService,
    private readonly couponsService: CouponsService,
    private readonly settingsService: SettingsService,
    private readonly campaignPricing: CampaignPricingService,
    private readonly ledger: StockLedgerService,
  ) {}

  // ── Checkout ──────────────────────────────────────────────────────────────

  /** Live totals for the checkout summary. Reads only — reserves nothing. */
  async quote(userId: number, dto: QuoteOrderDto): Promise<OrderQuoteEntity> {
    const [cart, address, rules] = await Promise.all([
      this.cartsService.getCart({ type: 'user', id: userId }),
      dto.addressId !== undefined
        ? this.prisma.address.findFirst({
            where: { id: dto.addressId, userId },
            select: { city: true },
          })
        : Promise.resolve(null),
      this.settingsService.getSettings(),
    ]);
    if (dto.addressId !== undefined && !address) {
      throw new NotFoundException('Address does not exist for the current user.');
    }

    // A bad code shouldn't break the summary — report it next to the input.
    let coupon: CouponValidationEntity | null = null;
    let couponError: string | null = null;
    if (dto.couponCode && cart.items.length > 0) {
      try {
        coupon = await this.couponsService.evaluate(dto.couponCode, cart.totalPrice, { userId });
      } catch (error: unknown) {
        if (!(error instanceof HttpException)) throw error;
        couponError = error.message;
      }
    }

    const city = address?.city ?? null;
    const totals = totalsFor(cart.totalPrice, coupon, city, rules);
    const remaining = new Prisma.Decimal(rules.freeShippingThreshold).minus(cart.totalPrice);

    return new OrderQuoteEntity({
      itemCount: cart.totalItems,
      subtotal: totals.subtotal,
      discountAmount: totals.discount,
      shippingFee: totals.shipping,
      totalAmount: totals.total,
      coupon: coupon
        ? new QuoteCouponEntity({
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
          })
        : null,
      couponError,
      freeShippingThreshold: new Prisma.Decimal(rules.freeShippingThreshold),
      amountToFreeShipping: remaining.greaterThan(0) ? remaining : ZERO,
      insideDhaka: city === null ? null : isInsideDhaka(city),
      problems: cart.items.length === 0 ? ['Your cart is empty.'] : cartProblems(cart),
    });
  }

  async placeOrder(userId: number, dto: PlaceOrderDto): Promise<OrderEntity> {
    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId },
      select: {
        recipientName: true,
        phone: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        user: { select: { name: true, phone: true } },
      },
    });

    if (!address) {
      throw new NotFoundException('Address does not exist for the current user.');
    }

    const recipientName = address.recipientName ?? address.user.name;
    const phone = address.phone ?? address.user.phone;
    if (!phone) {
      throw new BadRequestException(
        'Add a phone number to this address so the courier can reach you.',
      );
    }

    const identity: CartIdentity = { type: 'user', id: userId };
    const [cart, rules] = await Promise.all([
      this.cartsService.getCart(identity),
      this.settingsService.getSettings(),
    ]);

    if (cart.items.length === 0) {
      throw new BadRequestException('Cannot place an order with an empty cart.');
    }
    if (cart.hasIssues) {
      throw new ConflictException(cartProblems(cart));
    }

    // Deterministic lock ordering: every checkout touches rows in the same
    // (productId, variantId) order, so overlapping concurrent orders can
    // never deadlock on each other's row locks.
    const lines: CheckoutLine[] = cart.items
      .map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      }))
      .sort((a, b) => a.productId - b.productId || (a.variantId ?? 0) - (b.variantId ?? 0));

    const order = await this.prisma.$transaction(async (tx) => {
      const priced = await this.priceLines(tx, lines);
      const subtotal = priced.reduce(
        (sum, line) => sum.plus(line.unitPrice.times(line.quantity)),
        ZERO,
      );

      const coupon = dto.couponCode
        ? await this.couponsService.evaluate(dto.couponCode, subtotal, { userId })
        : null;
      if (coupon) await this.couponsService.redeem(tx, coupon, userId);

      const totals = totalsFor(subtotal, coupon, address.city, rules);
      const snapshot: ShippingAddressEntityInput = {
        recipientName,
        phone,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
      };

      const created = await tx.order.create({
        data: {
          userId,
          totalAmount: totals.total,
          discountAmount: totals.discount,
          shippingFee: totals.shipping ?? ZERO,
          couponCode: coupon?.code ?? null,
          couponId: coupon?.couponId ?? null,
          note: dto.note || null,
          // Every field is a plain string/null, which Prisma.InputJsonValue
          // accepts at runtime; the interface just lacks an index signature.
          shippingAddress: snapshot as unknown as Prisma.InputJsonValue,
          items: {
            create: priced.map((line) => ({
              productId: line.productId,
              variantId: line.variantId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              campaignId: line.campaignId,
            })),
          },
          payment: {
            create: { provider: PaymentProvider.COD, amount: totals.total },
          },
        },
        select: ORDER_SELECT,
      });
      // Same transaction: if any line is short, the whole order rolls back.
      await this.takeStock(tx, priced, created.id, userId);
      return created;
    });

    // Cart clearing is best-effort and deliberately outside the DB
    // transaction — Redis isn't part of Postgres's ACID guarantees, and the
    // order above is already durably committed. If this fails, log and move
    // on rather than report a false failure for an order that succeeded.
    try {
      await this.cartsService.clearCart(identity);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to clear cart after order ${order.id} for user ${userId}: ${message}`,
      );
    }

    return this.toEntity(order);
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  async findAll(requester: AuthUser, query: OrderQueryDto): Promise<PaginatedOrdersEntity> {
    const scope = this.buildScope(requester, query);
    const where: Prisma.OrderWhereInput =
      query.status !== undefined ? { ...scope, status: query.status } : scope;

    const [rows, total, grouped] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: ORDER_SELECT,
        orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
    ]);

    const countByStatus = new Map(grouped.map((group) => [group.status, group._count._all]));

    return new PaginatedOrdersEntity({
      items: rows.map((row) => this.toEntity(row)),
      meta: new PaginationMetaEntity({
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      }),
      statusCounts: ORDER_STATUS_VALUES.map(
        (status) => new OrderStatusCountEntity({ status, count: countByStatus.get(status) ?? 0 }),
      ),
    });
  }

  /** The caller's own history at a glance — always scoped to them, even for staff. */
  async summary(userId: number): Promise<OrderSummaryEntity> {
    const [grouped, spent, active] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], where: { userId }, _count: { _all: true } }),
      this.prisma.order.aggregate({
        where: { userId, status: OrderStatus.DELIVERED },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.findFirst({
        where: { userId, status: { in: [...IN_PROGRESS_STATUSES] } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: ORDER_SELECT,
      }),
    ]);

    const count = (statuses: readonly OrderStatus[]) =>
      grouped
        .filter((group) => statuses.includes(group.status))
        .reduce((sum, group) => sum + group._count._all, 0);

    return new OrderSummaryEntity({
      totalOrders: grouped.reduce((sum, group) => sum + group._count._all, 0),
      inProgress: count(IN_PROGRESS_STATUSES),
      delivered: count([OrderStatus.DELIVERED]),
      totalSpent: spent._sum.totalAmount ?? ZERO,
      activeOrder: active ? this.toEntity(active) : null,
    });
  }

  async findOne(requester: AuthUser, id: number): Promise<OrderEntity> {
    const order = await this.prisma.order.findFirst({
      where: { id, ...(this.isStaff(requester) ? {} : { userId: requester.id }) },
      select: ORDER_SELECT,
    });

    if (!order) {
      throw new NotFoundException('Order does not exist.');
    }

    return this.toEntity(order);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Customer self-service cancel, allowed only before fulfilment starts. */
  async cancel(requester: AuthUser, id: number): Promise<OrderEntity> {
    const order = await this.prisma.order.findFirst({
      where: { id, userId: requester.id },
      select: { status: true },
    });
    if (!order) throw new NotFoundException('Order does not exist.');
    if (!CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        order.status === OrderStatus.CANCELLED
          ? 'This order is already cancelled.'
          : "This order is already being prepared, so it can't be cancelled online. Please contact support.",
      );
    }

    return this.transition(id, order.status, OrderStatus.CANCELLED, { actorId: requester.id });
  }

  async updateStatus(
    id: number,
    dto: UpdateOrderStatusDto,
    actor?: AuthUser,
  ): Promise<OrderEntity> {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
    if (order.status === dto.status) {
      throw new BadRequestException(`This order is already ${dto.status.toLowerCase()}.`);
    }
    if (!ORDER_TRANSITIONS[order.status].includes(dto.status)) {
      throw new BadRequestException(
        `An order can't move from ${order.status.toLowerCase()} to ${dto.status.toLowerCase()}.`,
      );
    }
    return this.transition(id, order.status, dto.status, {
      actorId: actor?.id ?? null,
      restock: dto.restock,
    });
  }

  /**
   * Applies one status change with its side effects in a single transaction.
   * The conditional update on the *previous* status makes concurrent changes
   * (two admins, or admin vs. customer cancel) fail loudly instead of both
   * restocking.
   */
  private async transition(
    id: number,
    from: OrderStatus,
    to: OrderStatus,
    options: { actorId?: number | null; restock?: boolean } = {},
  ): Promise<OrderEntity> {
    const row = await this.prisma.$transaction(async (tx) => {
      const moved = await tx.order.updateMany({
        where: { id, status: from },
        data: { status: to },
      });
      if (moved.count === 0) {
        throw new ConflictException(
          'This order was just updated by someone else. Refresh and try again.',
        );
      }

      const current = await tx.order.findUniqueOrThrow({
        where: { id },
        select: {
          couponId: true,
          couponCode: true,
          stockRestoredAt: true,
          paymentStatus: true,
          payment: { select: { provider: true } },
          items: { select: { productId: true, variantId: true, quantity: true } },
        },
      });

      if (to === OrderStatus.CANCELLED && RESTOCK_ON_CANCEL_STATUSES.includes(from)) {
        await this.returnStock(
          tx,
          current.items,
          StockMovementType.ORDER_CANCELLED,
          id,
          options.actorId,
        );
        await this.couponsService.release(tx, current);
      }
      // Returned goods go back on the shelf (default) or are written off as
      // unsellable — recorded either way, and only ever once per order.
      if (to === OrderStatus.RETURNED && current.stockRestoredAt === null) {
        await this.returnStock(
          tx,
          current.items,
          options.restock === false
            ? StockMovementType.RETURN_WRITTEN_OFF
            : StockMovementType.RETURN_RESTOCKED,
          id,
          options.actorId,
        );
        await tx.order.update({
          where: { id },
          data: { stockRestoredAt: new Date() },
          select: { id: true },
        });
      }

      // Cash on delivery is collected by the courier: delivered ⇒ paid.
      // A cancelled order that was already paid online is refunded.
      const paymentStatus =
        to === OrderStatus.DELIVERED &&
        current.payment?.provider === PaymentProvider.COD &&
        current.paymentStatus === PaymentStatus.UNPAID
          ? PaymentStatus.PAID
          : to === OrderStatus.CANCELLED && current.paymentStatus === PaymentStatus.PAID
            ? PaymentStatus.REFUNDED
            : null;
      if (paymentStatus) {
        await tx.order.update({ where: { id }, data: { paymentStatus }, select: { id: true } });
        if (current.payment) {
          await tx.payment.update({
            where: { orderId: id },
            data: { status: paymentStatus },
            select: { id: true },
          });
        }
      }

      return tx.order.findUniqueOrThrow({ where: { id }, select: ORDER_SELECT });
    });

    return this.toEntity(row);
  }

  // ── Stock & coupons (always inside a transaction) ─────────────────────────

  private async priceLines(
    tx: Prisma.TransactionClient,
    lines: CheckoutLine[],
  ): Promise<PricedLine[]> {
    const productIds = [...new Set(lines.map((line) => line.productId))];
    const variantIds = lines.flatMap((line) => (line.variantId === null ? [] : [line.variantId]));
    const [products, variants] = await Promise.all([
      tx.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          isPublished: true,
          stockQuantity: true,
          categoryId: true,
          basePrice: true,
          discountPrice: true,
        },
      }),
      tx.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: { id: true, productId: true, price: true, stockQuantity: true },
      }),
    ]);
    const productById = new Map(products.map((product) => [product.id, product]));
    const variantById = new Map(variants.map((variant) => [variant.id, variant]));
    // Checkout re-prices from the clock: a sale that just ended no longer applies.
    const offers = await this.campaignPricing.offersFor(products);

    // Validate every line up front: one complete error, not a partial write.
    const problems: string[] = [];
    const priced: PricedLine[] = [];
    for (const line of lines) {
      const product = productById.get(line.productId);
      const variant = line.variantId === null ? null : variantById.get(line.variantId);
      if (!product || variant === undefined || (variant && variant.productId !== product.id)) {
        problems.push('An item in your cart no longer exists — review your cart and try again.');
        continue;
      }
      if (!product.isPublished) {
        problems.push(`"${product.name}" is no longer available for purchase.`);
        continue;
      }
      const available = variant ? variant.stockQuantity : product.stockQuantity;
      if (available < line.quantity) {
        problems.push(
          `Only ${available} left of "${product.name}" — lower the quantity to continue.`,
        );
        continue;
      }
      const price = applyCampaign(linePrice(product, variant), offers.get(product.id));
      priced.push({
        ...line,
        unitPrice: price.unitPrice,
        campaignId: price.offer?.campaignId ?? null,
      });
    }

    if (problems.length > 0) throw new ConflictException(problems);
    return priced;
  }

  /** Takes each line's units through the ledger ("Sold", linked to the order). */
  private async takeStock(
    tx: Prisma.TransactionClient,
    lines: PricedLine[],
    orderId: number,
    actorId: number,
  ): Promise<void> {
    try {
      await this.ledger.apply(
        tx,
        lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          delta: -line.quantity,
          type: StockMovementType.SALE,
          orderId,
          actorId,
        })),
      );
    } catch (error: unknown) {
      if (error instanceof InsufficientStockError) {
        throw new ConflictException(
          'An item in your cart was just bought by someone else. Review your cart and try again.',
        );
      }
      throw error;
    }
  }

  /** Puts an order's units back (or, for a write-off, records them without restocking). */
  private async returnStock(
    tx: Prisma.TransactionClient,
    lines: ReadonlyArray<{ productId: number; variantId: number | null; quantity: number }>,
    type: StockMovementType,
    orderId: number,
    actorId?: number | null,
  ): Promise<void> {
    await this.ledger.apply(
      tx,
      lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        delta: type === StockMovementType.RETURN_WRITTEN_OFF ? 0 : line.quantity,
        type,
        orderId,
        actorId: actorId ?? null,
        note:
          type === StockMovementType.RETURN_WRITTEN_OFF
            ? `${line.quantity} unit(s) not resellable`
            : null,
      })),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Staff who may see every order (not just their own). */
  private isStaff(requester: AuthUser): boolean {
    return hasPermission(requester, 'orders.view');
  }

  /** Who can see what, plus search — everything except the status filter. */
  private buildScope(requester: AuthUser, query: OrderQueryDto): Prisma.OrderWhereInput {
    if (query.scope === 'mine' || !this.isStaff(requester)) {
      // Own orders only (a plain USER always); userId/search are ignored.
      return { userId: requester.id };
    }

    const scope: Prisma.OrderWhereInput = {};
    if (query.userId !== undefined) scope.userId = query.userId;
    if (query.search !== undefined) {
      const orderId = /^#?(\d{1,9})$/.exec(query.search)?.[1];
      scope.OR = orderId
        ? [{ id: Number(orderId) }]
        : [
            { user: { email: { contains: query.search, mode: 'insensitive' } } },
            { user: { name: { contains: query.search, mode: 'insensitive' } } },
            { user: { phone: { contains: query.search } } },
          ];
    }
    return scope;
  }

  private toEntity(order: OrderRow): OrderEntity {
    // shippingAddress is never accepted as raw external input — it is only
    // ever written by placeOrder() (or the seeder) from our own snapshot, so
    // this cast is a safe internal invariant rather than a validated boundary.
    const shippingAddress = order.shippingAddress as unknown as ShippingAddressEntityInput;
    const items = order.items.map((item) => this.toItemEntity(item));

    return new OrderEntity({
      id: order.id,
      userId: order.userId,
      customer: order.user ? new OrderCustomerEntity(order.user) : null,
      status: order.status,
      nextStatuses: [...ORDER_TRANSITIONS[order.status]],
      paymentStatus: order.paymentStatus,
      payment: order.payment ? new OrderPaymentEntity(order.payment) : null,
      subtotal: items.reduce((sum, item) => sum.plus(item.subtotal), ZERO),
      totalAmount: order.totalAmount,
      discountAmount: order.discountAmount,
      shippingFee: order.shippingFee,
      couponCode: order.couponCode,
      note: order.note,
      shippingAddress: new ShippingAddressEntity(shippingAddress),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      items,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    });
  }

  private toItemEntity(item: OrderItemRow): OrderItemEntity {
    return new OrderItemEntity({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      variantLabel: item.variant
        ? variantLabel(item.variant.options.map((option) => option.attributeOption))
        : null,
      sku: item.variant?.sku ?? item.product.sku,
      product: new OrderItemProductSummaryEntity({
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        imageUrl: item.variant?.imageUrl ?? item.product.images[0]?.url ?? null,
      }),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.unitPrice.times(item.quantity),
    });
  }
}
