import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DiscountType, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CartsService } from '../carts/carts.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { COUPON_RECENT_ORDERS, formatTaka, type CouponStatus } from './coupons.constants';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { CouponQueryDto } from './dto/query-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import {
  CouponDetailEntity,
  CouponEntity,
  CouponOrderEntity,
  CouponSummaryEntity,
  CouponValidationEntity,
  PaginatedCouponsEntity,
  PaginationMetaEntity,
} from './entities/coupon.entity';

const COUPON_SELECT = {
  id: true,
  code: true,
  description: true,
  discountType: true,
  discountValue: true,
  minOrderAmount: true,
  maxDiscountAmount: true,
  usageLimit: true,
  perCustomerLimit: true,
  usedCount: true,
  validFrom: true,
  validUntil: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CouponSelect;

type CouponRow = Prisma.CouponGetPayload<{ select: typeof COUPON_SELECT }>;

/** The fields the business rules look at, in their stored shape. */
type CouponRules = Pick<
  CouponRow,
  | 'discountType'
  | 'discountValue'
  | 'minOrderAmount'
  | 'maxDiscountAmount'
  | 'usageLimit'
  | 'perCustomerLimit'
  | 'validFrom'
  | 'validUntil'
>;

interface CouponStats {
  orderCount: number;
  discountGiven: Prisma.Decimal;
  revenue: Prisma.Decimal;
}

const ZERO = new Prisma.Decimal(0);
const NO_STATS: CouponStats = { orderCount: 0, discountGiven: ZERO, revenue: ZERO };

/** Orders that count as a real use of a coupon. */
const COUNTED_ORDER = { status: { not: OrderStatus.CANCELLED } } satisfies Prisma.OrderWhereInput;

/** Fields whose change is worth naming in the audit trail. */
const AUDITED_FIELDS = [
  'code',
  'description',
  'discountType',
  'discountValue',
  'minOrderAmount',
  'maxDiscountAmount',
  'usageLimit',
  'perCustomerLimit',
  'validFrom',
  'validUntil',
  'isActive',
] as const;

export interface AuditContext {
  actor: AuthUser;
  ip: string | null;
}

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartsService: CartsService,
    private readonly audit: AuditService,
  ) {}

  // ── Admin reads ───────────────────────────────────────────────────────────

  async findAll(query: CouponQueryDto, now: Date = new Date()): Promise<PaginatedCouponsEntity> {
    const where = this.buildWhere(query, now);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.coupon.findMany({
        where,
        select: COUPON_SELECT,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.coupon.count({ where }),
    ]);

    const stats = await this.statsFor(rows.map((row) => row.id));

    return new PaginatedCouponsEntity({
      items: rows.map((row) => this.toEntity(row, stats.get(row.id), now)),
      meta: new PaginationMetaEntity({
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      }),
    });
  }

  async findOne(id: number, now: Date = new Date()): Promise<CouponDetailEntity> {
    const row = await this.prisma.coupon.findUniqueOrThrow({
      where: { id },
      select: COUPON_SELECT,
    });

    const [stats, customers, recent] = await Promise.all([
      this.statsFor([id]),
      this.prisma.$queryRaw<Array<{ n: number }>>`
        SELECT COUNT(DISTINCT user_id)::int AS n FROM orders
        WHERE coupon_id = ${id} AND status <> 'CANCELLED'`,
      this.prisma.order.findMany({
        where: { couponId: id },
        select: {
          id: true,
          status: true,
          totalAmount: true,
          discountAmount: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: COUPON_RECENT_ORDERS,
      }),
    ]);

    return new CouponDetailEntity({
      ...this.toEntity(row, stats.get(id), now),
      customerCount: customers[0]?.n ?? 0,
      recentOrders: recent.map(
        (order) =>
          new CouponOrderEntity({
            id: order.id,
            status: order.status,
            totalAmount: order.totalAmount,
            discountAmount: order.discountAmount,
            customer: order.user,
            createdAt: order.createdAt,
          }),
      ),
    });
  }

  /** Header tiles for the admin list: one round trip of cheap counts. */
  async summary(now: Date = new Date()): Promise<CouponSummaryEntity> {
    const statuses: CouponStatus[] = ['ACTIVE', 'SCHEDULED', 'USED_UP', 'EXPIRED', 'DISABLED'];
    const [counts, totals, endingSoon] = await Promise.all([
      this.prisma.$transaction(
        statuses.map((status) =>
          this.prisma.coupon.count({ where: this.statusWhere(status, now) }),
        ),
      ),
      this.prisma.order.aggregate({
        where: { couponId: { not: null }, ...COUNTED_ORDER },
        _count: { _all: true },
        _sum: { discountAmount: true, totalAmount: true },
      }),
      this.prisma.coupon.findFirst({
        where: this.statusWhere('ACTIVE', now),
        select: { id: true, code: true, validUntil: true },
        orderBy: [{ validUntil: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const statusCounts = Object.fromEntries(
      statuses.map((status, index) => [status, counts[index]]),
    ) as Record<CouponStatus, number>;

    return new CouponSummaryEntity({
      statusCounts,
      total: counts.reduce((sum, n) => sum + n, 0),
      orderCount: totals._count._all,
      discountGiven: totals._sum.discountAmount ?? ZERO,
      revenue: totals._sum.totalAmount ?? ZERO,
      endingSoon,
    });
  }

  // ── Admin writes ──────────────────────────────────────────────────────────

  async create(dto: CreateCouponDto, ctx?: AuditContext): Promise<CouponEntity> {
    const data = this.normalize({
      ...dto,
      code: dto.code.toUpperCase(),
      description: dto.description || null,
      discountValue: new Prisma.Decimal(dto.discountValue),
      minOrderAmount: this.decimalOrNull(dto.minOrderAmount),
      maxDiscountAmount: this.decimalOrNull(dto.maxDiscountAmount),
      usageLimit: dto.usageLimit ?? null,
      perCustomerLimit: dto.perCustomerLimit ?? null,
      validFrom: new Date(dto.validFrom),
      validUntil: new Date(dto.validUntil),
    });
    this.assertCoherent(data);

    const coupon = await this.prisma.coupon.create({ data, select: COUPON_SELECT });

    if (ctx) {
      await this.audit.record({
        actor: ctx.actor,
        action: 'coupon.created',
        targetType: 'coupon',
        targetId: coupon.id,
        summary: `Created coupon ${coupon.code} (${this.describe(coupon)})`,
        ipAddress: ctx.ip,
      });
    }
    return this.toEntity(coupon);
  }

  async update(id: number, dto: UpdateCouponDto, ctx?: AuditContext): Promise<CouponEntity> {
    const current = await this.prisma.coupon.findUniqueOrThrow({
      where: { id },
      select: COUPON_SELECT,
    });

    const merged = this.normalize({
      ...current,
      ...(dto.code !== undefined && { code: dto.code.toUpperCase() }),
      ...(dto.description !== undefined && { description: dto.description || null }),
      ...(dto.discountType !== undefined && { discountType: dto.discountType }),
      ...(dto.discountValue !== undefined && {
        discountValue: new Prisma.Decimal(dto.discountValue),
      }),
      ...(dto.minOrderAmount !== undefined && {
        minOrderAmount: this.decimalOrNull(dto.minOrderAmount),
      }),
      ...(dto.maxDiscountAmount !== undefined && {
        maxDiscountAmount: this.decimalOrNull(dto.maxDiscountAmount),
      }),
      ...(dto.usageLimit !== undefined && { usageLimit: dto.usageLimit }),
      ...(dto.perCustomerLimit !== undefined && { perCustomerLimit: dto.perCustomerLimit }),
      ...(dto.validFrom !== undefined && { validFrom: new Date(dto.validFrom) }),
      ...(dto.validUntil !== undefined && { validUntil: new Date(dto.validUntil) }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
    this.assertCoherent(merged);

    const changed = AUDITED_FIELDS.filter(
      (field) => this.comparable(current[field]) !== this.comparable(merged[field]),
    );

    const coupon = await this.prisma.coupon.update({
      where: { id },
      data: {
        code: merged.code,
        description: merged.description,
        discountType: merged.discountType,
        discountValue: merged.discountValue,
        minOrderAmount: merged.minOrderAmount,
        maxDiscountAmount: merged.maxDiscountAmount,
        usageLimit: merged.usageLimit,
        perCustomerLimit: merged.perCustomerLimit,
        validFrom: merged.validFrom,
        validUntil: merged.validUntil,
        isActive: merged.isActive,
      },
      select: COUPON_SELECT,
    });

    if (ctx && changed.length > 0) {
      const onlyToggled = changed.length === 1 && changed[0] === 'isActive';
      await this.audit.record({
        actor: ctx.actor,
        action: 'coupon.updated',
        targetType: 'coupon',
        targetId: id,
        summary: onlyToggled
          ? `${coupon.isActive ? 'Switched on' : 'Switched off'} coupon ${coupon.code}`
          : `Updated coupon ${coupon.code}: ${changed.join(', ')}`,
        metadata: { fields: [...changed] },
        ipAddress: ctx.ip,
      });
    }

    const stats = await this.statsFor([id]);
    return this.toEntity(coupon, stats.get(id));
  }

  /**
   * Only never-used coupons can be deleted: a used one is part of order
   * history and reporting, so it's switched off instead.
   */
  async remove(id: number, ctx?: AuditContext): Promise<void> {
    const coupon = await this.prisma.coupon.findUniqueOrThrow({
      where: { id },
      select: { code: true, _count: { select: { orders: true } } },
    });
    const uses = coupon._count.orders;
    if (uses > 0) {
      throw new ConflictException(
        `${coupon.code} is on ${uses} ${uses === 1 ? 'order' : 'orders'}, so it can't be deleted. Switch it off instead — it keeps your reports accurate.`,
      );
    }

    await this.prisma.coupon.delete({ where: { id } });

    if (ctx) {
      await this.audit.record({
        actor: ctx.actor,
        action: 'coupon.deleted',
        targetType: 'coupon',
        targetId: id,
        summary: `Deleted coupon ${coupon.code}`,
        ipAddress: ctx.ip,
      });
    }
  }

  // ── Shopper side ──────────────────────────────────────────────────────────

  async validate(userId: number, dto: ValidateCouponDto): Promise<CouponValidationEntity> {
    // Lazy: the coupon's own checks run first, so an invalid code reports
    // as invalid whatever the cart holds.
    return this.evaluate(
      dto.code,
      async () => {
        const cart = await this.cartsService.getCart({ type: 'user', id: userId });
        if (cart.items.length === 0) {
          throw new BadRequestException('Cannot validate a coupon with an empty cart.');
        }
        return cart.totalPrice;
      },
      { userId },
    );
  }

  /**
   * Checks a code against an order amount and computes its discount. The
   * single source of the coupon rules — used by /coupons/validate and by
   * checkout (quote + place order). Throws the same errors in both paths.
   */
  async evaluate(
    rawCode: string,
    amount: Prisma.Decimal | (() => Promise<Prisma.Decimal>),
    options: { userId?: number; now?: Date } = {},
  ): Promise<CouponValidationEntity> {
    const code = rawCode.trim().toUpperCase();
    const now = options.now ?? new Date();

    const coupon = await this.prisma.coupon.findUnique({
      where: { code },
      select: COUPON_SELECT,
    });

    // Non-existent and deactivated codes report the exact same generic
    // message — this endpoint is rate-limited specifically because a coupon
    // code is a guessable secret, so we don't want to hand back a channel
    // ("this one used to exist") that helps an attacker narrow down real codes.
    if (!coupon || !coupon.isActive) {
      throw new NotFoundException('Coupon code is invalid.');
    }

    if (now < coupon.validFrom) {
      throw new BadRequestException('This coupon is not active yet.');
    }
    if (now > coupon.validUntil) {
      throw new BadRequestException('This coupon has expired.');
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('This coupon has reached its usage limit.');
    }
    if (options.userId !== undefined && coupon.perCustomerLimit !== null) {
      const used = await this.prisma.order.count({
        where: { couponId: coupon.id, userId: options.userId, ...COUNTED_ORDER },
      });
      if (used >= coupon.perCustomerLimit) throw this.perCustomerError(coupon.perCustomerLimit);
    }

    const orderAmount = typeof amount === 'function' ? await amount() : amount;

    if (coupon.minOrderAmount !== null && orderAmount.lessThan(coupon.minOrderAmount)) {
      throw new BadRequestException(
        `Add ${formatTaka(coupon.minOrderAmount.minus(orderAmount))} more to use this coupon — it needs an order of ${formatTaka(coupon.minOrderAmount)}.`,
      );
    }

    const freeShipping = coupon.discountType === DiscountType.FREE_SHIPPING;
    let discountAmount = freeShipping
      ? ZERO
      : coupon.discountType === DiscountType.PERCENTAGE
        ? orderAmount.times(coupon.discountValue).dividedBy(100)
        : coupon.discountValue;

    if (coupon.maxDiscountAmount !== null && discountAmount.greaterThan(coupon.maxDiscountAmount)) {
      discountAmount = coupon.maxDiscountAmount;
    }
    if (discountAmount.greaterThan(orderAmount)) {
      discountAmount = orderAmount;
    }

    return new CouponValidationEntity({
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      // Whole poisha: money columns are Decimal(12, 2).
      discountAmount: discountAmount.toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN),
      orderAmount,
      freeShipping,
      perCustomerLimit: coupon.perCustomerLimit,
    });
  }

  /**
   * Counts one use, inside the checkout transaction. The UPDATE row-locks the
   * coupon, so concurrent checkouts with the same code are serialized — both
   * the global limit and the per-customer count below are race-free.
   */
  async redeem(
    tx: Prisma.TransactionClient,
    coupon: CouponValidationEntity,
    userId: number,
  ): Promise<void> {
    const updated = await tx.$executeRaw`
      UPDATE coupons SET used_count = used_count + 1, updated_at = NOW()
      WHERE id = ${coupon.couponId} AND is_active = TRUE
        AND (usage_limit IS NULL OR used_count < usage_limit)`;
    if (updated === 0) {
      throw new ConflictException(
        'This coupon was just used up or switched off. Remove it to continue.',
      );
    }

    if (coupon.perCustomerLimit !== null) {
      const used = await tx.order.count({
        where: { couponId: coupon.couponId, userId, ...COUNTED_ORDER },
      });
      if (used >= coupon.perCustomerLimit) throw this.perCustomerError(coupon.perCustomerLimit);
    }
  }

  /** Gives a use back (order cancelled). Legacy orders only carry the code. */
  async release(
    tx: Prisma.TransactionClient,
    order: { couponId: number | null; couponCode: string | null },
  ): Promise<void> {
    if (order.couponId !== null) {
      await tx.$executeRaw`
        UPDATE coupons SET used_count = GREATEST(used_count - 1, 0), updated_at = NOW()
        WHERE id = ${order.couponId}`;
    } else if (order.couponCode) {
      await tx.$executeRaw`
        UPDATE coupons SET used_count = GREATEST(used_count - 1, 0), updated_at = NOW()
        WHERE code = ${order.couponCode}`;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  statusOf(
    row: Pick<CouponRow, 'isActive' | 'validFrom' | 'validUntil' | 'usageLimit' | 'usedCount'>,
    now: Date = new Date(),
  ): CouponStatus {
    if (!row.isActive) return 'DISABLED';
    if (now > row.validUntil) return 'EXPIRED';
    if (now < row.validFrom) return 'SCHEDULED';
    if (row.usageLimit !== null && row.usedCount >= row.usageLimit) return 'USED_UP';
    return 'ACTIVE';
  }

  /** The same precedence as statusOf, as a WHERE clause (indexable). */
  private statusWhere(status: CouponStatus, now: Date): Prisma.CouponWhereInput {
    const live = { isActive: true, validFrom: { lte: now }, validUntil: { gte: now } };
    const usageLimit = this.prisma.coupon.fields.usageLimit;
    switch (status) {
      case 'DISABLED':
        return { isActive: false };
      case 'EXPIRED':
        return { isActive: true, validUntil: { lt: now } };
      case 'SCHEDULED':
        return { isActive: true, validFrom: { gt: now }, validUntil: { gte: now } };
      case 'USED_UP':
        return { ...live, usedCount: { gte: usageLimit } };
      case 'ACTIVE':
        return { ...live, OR: [{ usageLimit: null }, { usedCount: { lt: usageLimit } }] };
    }
  }

  private buildWhere(query: CouponQueryDto, now: Date): Prisma.CouponWhereInput {
    const where: Prisma.CouponWhereInput = query.status ? this.statusWhere(query.status, now) : {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search !== undefined) {
      where.code = { contains: query.search, mode: 'insensitive' };
    }

    return where;
  }

  /** Real usage from orders, for a page of coupons — one grouped query. */
  private async statsFor(ids: number[]): Promise<Map<number, CouponStats>> {
    if (ids.length === 0) return new Map();
    const groups = await this.prisma.order.groupBy({
      by: ['couponId'],
      where: { couponId: { in: ids }, ...COUNTED_ORDER },
      _count: { _all: true },
      _sum: { discountAmount: true, totalAmount: true },
    });
    return new Map(
      groups
        .filter((group) => group.couponId !== null)
        .map((group) => [
          group.couponId as number,
          {
            orderCount: group._count._all,
            discountGiven: group._sum.discountAmount ?? ZERO,
            revenue: group._sum.totalAmount ?? ZERO,
          },
        ]),
    );
  }

  /** Drops settings that mean nothing for the chosen type. */
  private normalize<T extends CouponRules>(coupon: T): T {
    if (coupon.discountType === DiscountType.FREE_SHIPPING) {
      return { ...coupon, discountValue: ZERO, maxDiscountAmount: null };
    }
    if (coupon.discountType === DiscountType.FIXED_AMOUNT) {
      return { ...coupon, maxDiscountAmount: null };
    }
    return coupon;
  }

  /** Cross-field rules, checked on the final (merged) coupon. */
  private assertCoherent(coupon: CouponRules): void {
    if (coupon.validUntil <= coupon.validFrom) {
      throw new BadRequestException('The end date must be after the start date.');
    }
    if (coupon.discountType === DiscountType.PERCENTAGE) {
      if (coupon.discountValue.lte(0) || coupon.discountValue.gt(100)) {
        throw new BadRequestException('A percentage discount must be between 1 and 100.');
      }
    }
    if (coupon.discountType === DiscountType.FIXED_AMOUNT && coupon.discountValue.lte(0)) {
      throw new BadRequestException('Enter how much the coupon takes off.');
    }
    if (
      coupon.usageLimit !== null &&
      coupon.perCustomerLimit !== null &&
      coupon.perCustomerLimit > coupon.usageLimit
    ) {
      throw new BadRequestException("Uses per customer can't be more than the total uses.");
    }
  }

  private perCustomerError(limit: number): BadRequestException {
    return new BadRequestException(
      limit === 1
        ? "You've already used this coupon."
        : `You've already used this coupon ${limit} times — the most allowed per customer.`,
    );
  }

  /** e.g. "10% off, up to ৳500" — for audit summaries. */
  private describe(coupon: CouponRules): string {
    if (coupon.discountType === DiscountType.FREE_SHIPPING) return 'free delivery';
    if (coupon.discountType === DiscountType.FIXED_AMOUNT) {
      return `${formatTaka(coupon.discountValue)} off`;
    }
    const cap = coupon.maxDiscountAmount ? `, up to ${formatTaka(coupon.maxDiscountAmount)}` : '';
    return `${coupon.discountValue.toString()}% off${cap}`;
  }

  private decimalOrNull(value: number | null | undefined): Prisma.Decimal | null {
    return value === null || value === undefined ? null : new Prisma.Decimal(value);
  }

  private comparable(value: Date | Prisma.Decimal | string | number | boolean | null): string {
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Prisma.Decimal) return value.toString();
    if (value === null) return '';
    return String(value);
  }

  private toEntity(
    coupon: CouponRow,
    stats: CouponStats = NO_STATS,
    now = new Date(),
  ): CouponEntity {
    return new CouponEntity({
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderAmount: coupon.minOrderAmount,
      maxDiscountAmount: coupon.maxDiscountAmount,
      usageLimit: coupon.usageLimit,
      perCustomerLimit: coupon.perCustomerLimit,
      usedCount: coupon.usedCount,
      validFrom: coupon.validFrom,
      validUntil: coupon.validUntil,
      isActive: coupon.isActive,
      status: this.statusOf(coupon, now),
      ...stats,
      createdAt: coupon.createdAt,
      updatedAt: coupon.updatedAt,
    });
  }
}
