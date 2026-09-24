import {
  PrismaClient,
  DiscountType,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Role,
  type Prisma,
} from '@prisma/client';
import { faker } from '@faker-js/faker';
import type { Seeder } from './seeder.interface';
import {
  insertAll,
  resetIdentitySequence,
  truncateTables,
  daysAgo,
  addDays,
  addHours,
  notAfterNow,
  decimalToPoisha,
  poishaToMoney,
  takaToPoisha,
} from './seeder.utils';
import {
  FREE_SHIPPING_THRESHOLD,
  LOCATIONS,
  SHIPPING_FEE_INSIDE_DHAKA,
  SHIPPING_FEE_OUTSIDE_DHAKA,
} from './data/people.data';
import { DEMO_CUSTOMER_EMAIL } from './user.seeder';

const TOTAL_ORDERS = 320;
const DEMO_CUSTOMER_ORDERS = 10;
const ORDER_HISTORY_DAYS = 180;
const MS_PER_DAY = 86_400_000;

interface SellableProduct {
  readonly id: number;
  readonly pricePoisha: number;
  readonly variants: ReadonlyArray<{ readonly id: number; readonly pricePoisha: number }>;
}

interface Customer {
  readonly id: number;
  readonly createdAt: Date;
  readonly addresses: ReadonlyArray<{
    readonly addressLine1: string;
    readonly addressLine2: string | null;
    readonly city: string;
    readonly state: string;
    readonly postalCode: string;
    readonly country: string;
  }>;
}

interface CouponRule {
  readonly discountType: DiscountType;
  readonly valuePoisha: number;
  readonly minOrderPoisha: number;
  readonly maxDiscountPoisha: number | null;
  readonly validFrom: Date;
  readonly validUntil: Date;
}

type Weighted<T> = Array<{ weight: number; value: T }>;

/** Order lifecycle is a function of age: fresh orders are pending, old ones settled. */
function statusWeightsForAge(ageDays: number): Weighted<OrderStatus> {
  if (ageDays < 1) {
    return [
      { weight: 70, value: OrderStatus.PENDING },
      { weight: 22, value: OrderStatus.PROCESSING },
      { weight: 8, value: OrderStatus.CANCELLED },
    ];
  }
  if (ageDays < 3) {
    return [
      { weight: 15, value: OrderStatus.PENDING },
      { weight: 50, value: OrderStatus.PROCESSING },
      { weight: 27, value: OrderStatus.SHIPPED },
      { weight: 8, value: OrderStatus.CANCELLED },
    ];
  }
  if (ageDays < 7) {
    return [
      { weight: 10, value: OrderStatus.PROCESSING },
      { weight: 40, value: OrderStatus.SHIPPED },
      { weight: 42, value: OrderStatus.DELIVERED },
      { weight: 8, value: OrderStatus.CANCELLED },
    ];
  }
  return [
    { weight: 82, value: OrderStatus.DELIVERED },
    { weight: 9, value: OrderStatus.CANCELLED },
    { weight: 9, value: OrderStatus.RETURNED },
  ];
}

/** Days between placement and the order's latest status change. */
function daysToReachStatus(status: OrderStatus): number {
  switch (status) {
    case OrderStatus.PENDING:
      return 0;
    case OrderStatus.PROCESSING:
      return faker.number.float({ min: 0.1, max: 1 });
    case OrderStatus.SHIPPED:
      return faker.number.float({ min: 1, max: 2.5 });
    case OrderStatus.DELIVERED:
      return faker.number.float({ min: 2, max: 5 });
    case OrderStatus.CANCELLED:
      return faker.number.float({ min: 0.05, max: 1.5 });
    case OrderStatus.RETURNED:
      return faker.number.float({ min: 7, max: 14 });
  }
}

/**
 * Payment state must agree with order state: a delivered order is paid, a
 * returned one refunded, an unshipped COD order still unpaid, and so on.
 */
function resolvePaymentStatus(status: OrderStatus, provider: PaymentProvider): PaymentStatus {
  const isCod = provider === PaymentProvider.COD;

  switch (status) {
    case OrderStatus.DELIVERED:
      return PaymentStatus.PAID;
    case OrderStatus.RETURNED:
      return PaymentStatus.REFUNDED;
    case OrderStatus.SHIPPED:
    case OrderStatus.PROCESSING:
      return isCod ? PaymentStatus.UNPAID : PaymentStatus.PAID;
    case OrderStatus.PENDING:
      if (isCod) {
        return PaymentStatus.UNPAID;
      }
      return faker.datatype.boolean({ probability: 0.2 })
        ? PaymentStatus.FAILED
        : PaymentStatus.UNPAID;
    case OrderStatus.CANCELLED:
      if (isCod) {
        return PaymentStatus.UNPAID;
      }
      return faker.helpers.weightedArrayElement([
        { weight: 60, value: PaymentStatus.REFUNDED },
        { weight: 25, value: PaymentStatus.FAILED },
        { weight: 15, value: PaymentStatus.UNPAID },
      ]);
  }
}

function transactionIdFor(provider: PaymentProvider): string {
  switch (provider) {
    case PaymentProvider.BKASH:
      return `BK${faker.string.alphanumeric({ length: 10, casing: 'upper' })}`;
    case PaymentProvider.SSLCOMMERZ:
      return `SSLCZ${faker.string.numeric(14)}`;
    case PaymentProvider.STRIPE:
      return `pi_${faker.string.alphanumeric({ length: 24 })}`;
    case PaymentProvider.COD:
      return `COD${faker.string.numeric(10)}`;
  }
}

function couponDiscountPoisha(coupon: CouponRule, subtotalPoisha: number): number {
  const raw =
    coupon.discountType === DiscountType.PERCENTAGE
      ? Math.round((subtotalPoisha * coupon.valuePoisha) / 10_000)
      : coupon.valuePoisha;
  const capped = coupon.maxDiscountPoisha === null ? raw : Math.min(raw, coupon.maxDiscountPoisha);
  return Math.min(capped, subtotalPoisha);
}

export class OrderSeeder implements Seeder {
  readonly name = 'OrderSeeder';
  readonly description = 'Seeds 6 months of orders with line items and payments';
  readonly order = 9;

  async seed(prisma: PrismaClient): Promise<void> {
    console.info('🧹 Cleaning "orders", "order_items" and "payments" tables...');
    await truncateTables(prisma, ['payments', 'order_items', 'orders']);

    const [customers, demoCustomer, products, coupons] = await Promise.all([
      this.loadCustomers(prisma),
      prisma.user.findUnique({ where: { email: DEMO_CUSTOMER_EMAIL }, select: { id: true } }),
      this.loadSellableProducts(prisma),
      this.loadCoupons(prisma),
    ]);

    if (customers.length === 0 || products.length === 0) {
      throw new Error('OrderSeeder requires seeded customers (with addresses) and products.');
    }

    const now = new Date();
    const orders: Prisma.OrderCreateManyInput[] = [];
    const items: Prisma.OrderItemCreateManyInput[] = [];
    const payments: Prisma.PaymentCreateManyInput[] = [];
    const usedTransactionIds = new Set<string>();

    // A shuffled "deck" of products, re-shuffled when exhausted, spreads
    // sales evenly so every published product ends up with order history
    // (and therefore verified-purchase reviews) instead of a random few.
    let deck: SellableProduct[] = [];
    const drawProduct = (exclude: ReadonlySet<number>): SellableProduct => {
      for (let attempt = 0; attempt < products.length * 2; attempt++) {
        if (deck.length === 0) {
          deck = faker.helpers.shuffle([...products]);
        }
        const candidate = deck.pop();
        if (candidate && !exclude.has(candidate.id)) {
          return candidate;
        }
      }
      throw new Error('Unable to draw a distinct product for an order line.');
    };

    // Returning customers place most orders — weight a small cohort heavily.
    const loyalCustomers = faker.helpers.arrayElements(customers, Math.ceil(customers.length / 4));
    const demo = customers.find((customer) => customer.id === demoCustomer?.id);

    for (let index = 0; index < TOTAL_ORDERS; index++) {
      const orderId = index + 1;
      const customer =
        demo && index < DEMO_CUSTOMER_ORDERS
          ? demo
          : faker.datatype.boolean({ probability: 0.45 })
            ? faker.helpers.arrayElement(loyalCustomers)
            : faker.helpers.arrayElement(customers);

      const earliest = new Date(
        Math.max(customer.createdAt.getTime(), daysAgo(ORDER_HISTORY_DAYS, now).getTime()),
      );
      // Bias toward recent days so the admin queue has a realistic volume of
      // in-flight (pending / processing / shipped) orders, not just history.
      const windowDays = faker.helpers.weightedArrayElement([
        { weight: 18, value: 3 },
        { weight: 14, value: 10 },
        { weight: 68, value: ORDER_HISTORY_DAYS },
      ]);
      const windowStart = daysAgo(windowDays, now);
      const createdAt = faker.date.between({
        from: windowStart > earliest ? windowStart : earliest,
        to: now,
      });
      const ageDays = (now.getTime() - createdAt.getTime()) / MS_PER_DAY;
      const status = faker.helpers.weightedArrayElement(statusWeightsForAge(ageDays));
      const updatedAt = notAfterNow(addDays(createdAt, daysToReachStatus(status)));

      // ── Line items ────────────────────────────────────────────────────────
      const lineCount = faker.helpers.weightedArrayElement([
        { weight: 45, value: 1 },
        { weight: 30, value: 2 },
        { weight: 17, value: 3 },
        { weight: 8, value: 4 },
      ]);
      const chosen = new Set<number>();
      let subtotalPoisha = 0;

      for (let line = 0; line < lineCount; line++) {
        const product = drawProduct(chosen);
        chosen.add(product.id);

        const variant =
          product.variants.length > 0 ? faker.helpers.arrayElement(product.variants) : null;
        const unitPricePoisha = variant ? variant.pricePoisha : product.pricePoisha;
        const quantity = faker.helpers.weightedArrayElement([
          { weight: 82, value: 1 },
          { weight: 14, value: 2 },
          { weight: 4, value: 3 },
        ]);
        subtotalPoisha += unitPricePoisha * quantity;

        items.push({
          orderId,
          productId: product.id,
          variantId: variant?.id ?? null,
          quantity,
          unitPrice: poishaToMoney(unitPricePoisha),
        });
      }

      // ── Discount, shipping and totals ─────────────────────────────────────
      const eligibleCoupons = coupons.filter(
        (coupon) =>
          coupon.validFrom <= createdAt &&
          coupon.validUntil >= createdAt &&
          coupon.minOrderPoisha <= subtotalPoisha,
      );
      const coupon =
        eligibleCoupons.length > 0 && faker.datatype.boolean({ probability: 0.28 })
          ? faker.helpers.arrayElement(eligibleCoupons)
          : null;
      const discountPoisha = coupon ? couponDiscountPoisha(coupon, subtotalPoisha) : 0;

      const address = faker.helpers.arrayElement(customer.addresses);
      const insideDhaka = LOCATIONS.some(
        (location) =>
          location.insideDhaka &&
          location.city === address.city &&
          location.postalCode === address.postalCode,
      );
      const shippingPoisha =
        subtotalPoisha >= takaToPoisha(FREE_SHIPPING_THRESHOLD)
          ? 0
          : takaToPoisha(insideDhaka ? SHIPPING_FEE_INSIDE_DHAKA : SHIPPING_FEE_OUTSIDE_DHAKA);
      const totalPoisha = subtotalPoisha - discountPoisha + shippingPoisha;

      // ── Payment ───────────────────────────────────────────────────────────
      const provider = faker.helpers.weightedArrayElement([
        { weight: 42, value: PaymentProvider.COD },
        { weight: 26, value: PaymentProvider.BKASH },
        { weight: 22, value: PaymentProvider.SSLCOMMERZ },
        { weight: 10, value: PaymentProvider.STRIPE },
      ]);
      const paymentStatus = resolvePaymentStatus(status, provider);

      orders.push({
        id: orderId,
        userId: customer.id,
        status,
        paymentStatus,
        totalAmount: poishaToMoney(totalPoisha),
        discountAmount: poishaToMoney(discountPoisha),
        shippingFee: poishaToMoney(shippingPoisha),
        // Frozen snapshot, exactly the shape OrdersService writes at checkout.
        shippingAddress: {
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
        },
        createdAt,
        updatedAt,
      });

      // Online gateways issue a transaction id on every attempt; COD only
      // gets a courier collection reference once cash has changed hands.
      const hasTransaction =
        provider === PaymentProvider.COD
          ? paymentStatus === PaymentStatus.PAID || paymentStatus === PaymentStatus.REFUNDED
          : paymentStatus !== PaymentStatus.UNPAID;
      let transactionId: string | null = null;
      if (hasTransaction) {
        do {
          transactionId = transactionIdFor(provider);
        } while (usedTransactionIds.has(transactionId));
        usedTransactionIds.add(transactionId);
      }

      payments.push({
        id: orderId,
        orderId,
        provider,
        transactionId,
        amount: poishaToMoney(totalPoisha),
        status: paymentStatus,
        createdAt: notAfterNow(addHours(createdAt, faker.number.float({ min: 0.01, max: 0.5 }))),
      });
    }

    await insertAll(prisma.order, orders, 'orders');
    await insertAll(prisma.orderItem, items, 'order_items');
    await insertAll(prisma.payment, payments, 'payments');
    await resetIdentitySequence(prisma, 'orders');
    await resetIdentitySequence(prisma, 'payments');

    const byStatus = orders.reduce<Partial<Record<OrderStatus, number>>>((acc, order) => {
      const key = order.status ?? OrderStatus.PENDING;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    console.info(
      `✅ Seeded ${orders.length} orders, ${items.length} line items and ${payments.length} payments.`,
    );
    console.info(`   Status mix: ${JSON.stringify(byStatus)}`);
  }

  async rollback(prisma: PrismaClient): Promise<void> {
    await truncateTables(prisma, ['payments', 'order_items', 'orders']);
    console.info('↩️  OrderSeeder rolled back.');
  }

  private async loadCustomers(prisma: PrismaClient): Promise<Customer[]> {
    const customers = await prisma.user.findMany({
      where: { role: Role.USER, isActive: true, deletedAt: null, addresses: { some: {} } },
      select: {
        id: true,
        createdAt: true,
        addresses: {
          select: {
            addressLine1: true,
            addressLine2: true,
            city: true,
            state: true,
            postalCode: true,
            country: true,
          },
          orderBy: { isDefault: 'desc' },
        },
      },
      orderBy: { id: 'asc' },
    });
    return customers;
  }

  private async loadSellableProducts(prisma: PrismaClient): Promise<SellableProduct[]> {
    const products = await prisma.product.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        basePrice: true,
        discountPrice: true,
        variants: { select: { id: true, price: true }, orderBy: { id: 'asc' } },
      },
      orderBy: { id: 'asc' },
    });

    return products.map((product) => ({
      id: product.id,
      pricePoisha: decimalToPoisha(product.discountPrice ?? product.basePrice),
      variants: product.variants.map((variant) => ({
        id: variant.id,
        pricePoisha: decimalToPoisha(variant.price),
      })),
    }));
  }

  private async loadCoupons(prisma: PrismaClient): Promise<CouponRule[]> {
    const coupons = await prisma.coupon.findMany({
      where: { isActive: true },
      select: {
        discountType: true,
        discountValue: true,
        minOrderAmount: true,
        maxDiscountAmount: true,
        validFrom: true,
        validUntil: true,
      },
    });

    return coupons.map((coupon) => ({
      discountType: coupon.discountType,
      valuePoisha: decimalToPoisha(coupon.discountValue),
      minOrderPoisha: coupon.minOrderAmount ? decimalToPoisha(coupon.minOrderAmount) : 0,
      maxDiscountPoisha: coupon.maxDiscountAmount
        ? decimalToPoisha(coupon.maxDiscountAmount)
        : null,
      validFrom: coupon.validFrom,
      validUntil: coupon.validUntil,
    }));
  }
}
