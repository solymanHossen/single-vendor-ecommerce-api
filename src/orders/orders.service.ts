import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CartsService } from '../carts/carts.service';
import type { CartIdentity } from '../carts/interfaces/cart-identity.interface';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { PlaceOrderDto } from './dto/place-order.dto';
import { OrderQueryDto } from './dto/query-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import {
  OrderEntity,
  OrderItemEntity,
  OrderItemProductSummaryEntity,
  PaginatedOrdersEntity,
  PaginationMetaEntity,
  ShippingAddressEntity,
  type ShippingAddressEntityInput,
} from './entities/order.entity';

const ORDER_ITEM_SELECT = {
  id: true,
  productId: true,
  quantity: true,
  unitPrice: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      images: { select: { url: true }, orderBy: { isThumbnail: 'desc' }, take: 1 },
    },
  },
} satisfies Prisma.OrderItemSelect;

const ORDER_SELECT = {
  id: true,
  userId: true,
  status: true,
  paymentStatus: true,
  totalAmount: true,
  discountAmount: true,
  shippingFee: true,
  shippingAddress: true,
  items: { select: ORDER_ITEM_SELECT, orderBy: { id: 'asc' } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrderSelect;

type OrderRow = Prisma.OrderGetPayload<{ select: typeof ORDER_SELECT }>;
type OrderItemRow = Prisma.OrderItemGetPayload<{ select: typeof ORDER_ITEM_SELECT }>;

interface ShoppingListEntry {
  productId: number;
  quantity: number;
}

interface ValidatedOrderItem {
  productId: number;
  quantity: number;
  unitPrice: Prisma.Decimal;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cartsService: CartsService,
  ) {}

  async placeOrder(userId: number, dto: PlaceOrderDto): Promise<OrderEntity> {
    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId },
      select: {
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
      },
    });

    if (!address) {
      throw new NotFoundException('Address does not exist for the current user.');
    }

    const identity: CartIdentity = { type: 'user', id: userId };
    const cart = await this.cartsService.getCart(identity);

    if (cart.items.length === 0) {
      throw new BadRequestException('Cannot place an order with an empty cart.');
    }

    // Deterministic lock ordering: every checkout touches product rows in
    // the same ascending id order, so two concurrent orders sharing
    // overlapping products can never deadlock on each other's row locks.
    const shoppingList: ShoppingListEntry[] = cart.items
      .map((item) => ({ productId: item.productId, quantity: item.quantity }))
      .sort((a, b) => a.productId - b.productId);

    const order = await this.prisma.$transaction(async (tx) => {
      const productIds = shoppingList.map((item) => item.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          isPublished: true,
          stockQuantity: true,
          basePrice: true,
          discountPrice: true,
        },
      });
      const productById = new Map(products.map((product) => [product.id, product]));

      // Pass 1 — validate every line item up front so a single problem
      // produces one clear, complete error instead of a partial write
      // followed by a rollback.
      const problems: string[] = [];
      const validatedItems: ValidatedOrderItem[] = [];

      for (const item of shoppingList) {
        const product = productById.get(item.productId);

        if (!product) {
          problems.push(`Product ${item.productId} no longer exists.`);
          continue;
        }
        if (!product.isPublished) {
          problems.push(`"${product.name}" is no longer available for purchase.`);
          continue;
        }
        if (product.stockQuantity < item.quantity) {
          problems.push(
            `Insufficient stock for "${product.name}": requested ${item.quantity}, available ${product.stockQuantity}.`,
          );
          continue;
        }

        validatedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: product.discountPrice ?? product.basePrice,
        });
      }

      if (problems.length > 0) {
        throw new ConflictException(problems);
      }

      // Pass 2 — the actual atomicity guarantee. Each conditional UPDATE
      // re-checks stock against the row's CURRENT value under Postgres's
      // row-level locking, closing the (rare) race window between pass 1's
      // read and this write. Pass 1 above only produces a nicer error
      // message for the common case; this is what makes the operation safe.
      for (const item of validatedItems) {
        const result = await tx.product.updateMany({
          where: { id: item.productId, stockQuantity: { gte: item.quantity } },
          data: { stockQuantity: { decrement: item.quantity } },
        });

        if (result.count === 0) {
          throw new ConflictException(
            `Insufficient stock for product ${item.productId} — it was purchased by someone else moments ago. Please review your cart and try again.`,
          );
        }
      }

      const totalAmount = validatedItems.reduce(
        (sum, item) => sum.plus(item.unitPrice.times(item.quantity)),
        new Prisma.Decimal(0),
      );

      const shippingAddressSnapshot: ShippingAddressEntityInput = {
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
      };

      return tx.order.create({
        data: {
          userId,
          totalAmount,
          // ShippingAddressEntityInput has no index signature of its own, so
          // it isn't structurally assignable to Prisma's JSON input type —
          // this cast is safe because every field here is already a plain
          // string/null, which Prisma.InputJsonValue accepts at runtime.
          shippingAddress: shippingAddressSnapshot as unknown as Prisma.InputJsonValue,
          items: {
            create: validatedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
        select: ORDER_SELECT,
      });
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

  async findAll(requester: AuthUser, query: OrderQueryDto): Promise<PaginatedOrdersEntity> {
    const isStaff = requester.role === Role.ADMIN || requester.role === Role.SUPER_ADMIN;
    const where: Prisma.OrderWhereInput = {};

    if (!isStaff) {
      // A plain USER can only ever see their own orders — query.userId is
      // ignored for them regardless of what was requested.
      where.userId = requester.id;
    } else if (query.userId !== undefined) {
      where.userId = query.userId;
    }

    if (query.status !== undefined) {
      where.status = query.status;
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        select: ORDER_SELECT,
        orderBy: { createdAt: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return new PaginatedOrdersEntity({
      items: rows.map((row) => this.toEntity(row)),
      meta: new PaginationMetaEntity({
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      }),
    });
  }

  async findOne(requester: AuthUser, id: number): Promise<OrderEntity> {
    const isStaff = requester.role === Role.ADMIN || requester.role === Role.SUPER_ADMIN;

    const order = await this.prisma.order.findFirst({
      where: { id, ...(isStaff ? {} : { userId: requester.id }) },
      select: ORDER_SELECT,
    });

    if (!order) {
      throw new NotFoundException('Order does not exist.');
    }

    return this.toEntity(order);
  }

  async updateStatus(id: number, dto: UpdateOrderStatusDto): Promise<OrderEntity> {
    const order = await this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
      select: ORDER_SELECT,
    });

    return this.toEntity(order);
  }

  private toEntity(order: OrderRow): OrderEntity {
    // shippingAddress is never accepted as raw external input — it is only
    // ever written by placeOrder() above from our own snapshot, so this cast
    // is a safe internal invariant rather than a validated system boundary.
    const shippingAddress = order.shippingAddress as unknown as ShippingAddressEntityInput;

    return new OrderEntity({
      id: order.id,
      userId: order.userId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
      discountAmount: order.discountAmount,
      shippingFee: order.shippingFee,
      shippingAddress: new ShippingAddressEntity(shippingAddress),
      items: order.items.map((item) => this.toItemEntity(item)),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    });
  }

  private toItemEntity(item: OrderItemRow): OrderItemEntity {
    return new OrderItemEntity({
      id: item.id,
      productId: item.productId,
      product: new OrderItemProductSummaryEntity({
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        imageUrl: item.product.images[0]?.url ?? null,
      }),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.unitPrice.times(item.quantity),
    });
  }
}
