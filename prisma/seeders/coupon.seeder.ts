import { PrismaClient, DiscountType, type Prisma } from '@prisma/client';
import type { Seeder } from './seeder.interface';
import { insertAll, truncateTable, daysAgo, addDays } from './seeder.utils';

/**
 * Coupon catalogue covering every state the checkout and admin screens need
 * to render: active percentage and fixed-amount codes, a nearly exhausted
 * flash code, an expired code, a scheduled (not-yet-valid) code and a
 * manually disabled one.
 */
function buildCoupons(now: Date): Prisma.CouponCreateManyInput[] {
  return [
    {
      code: 'WELCOME10',
      discountType: DiscountType.PERCENTAGE,
      discountValue: '10.00',
      minOrderAmount: '1000.00',
      maxDiscountAmount: '500.00',
      usageLimit: null,
      usedCount: 412,
      validFrom: daysAgo(365, now),
      validUntil: addDays(now, 365),
      isActive: true,
    },
    {
      code: 'SAVE500',
      discountType: DiscountType.FIXED_AMOUNT,
      discountValue: '500.00',
      minOrderAmount: '5000.00',
      maxDiscountAmount: null,
      usageLimit: 1000,
      usedCount: 238,
      validFrom: daysAgo(120, now),
      validUntil: addDays(now, 60),
      isActive: true,
    },
    {
      code: 'TECH15',
      discountType: DiscountType.PERCENTAGE,
      discountValue: '15.00',
      minOrderAmount: '20000.00',
      maxDiscountAmount: '5000.00',
      usageLimit: 300,
      usedCount: 91,
      validFrom: daysAgo(90, now),
      validUntil: addDays(now, 30),
      isActive: true,
    },
    {
      code: 'FLASH20',
      discountType: DiscountType.PERCENTAGE,
      discountValue: '20.00',
      minOrderAmount: '2000.00',
      maxDiscountAmount: '2000.00',
      usageLimit: 200,
      usedCount: 187,
      validFrom: daysAgo(10, now),
      validUntil: addDays(now, 4),
      isActive: true,
    },
    {
      code: 'FREESHIP',
      discountType: DiscountType.FIXED_AMOUNT,
      discountValue: '120.00',
      minOrderAmount: '1500.00',
      maxDiscountAmount: null,
      usageLimit: null,
      usedCount: 1054,
      validFrom: daysAgo(200, now),
      validUntil: addDays(now, 165),
      isActive: true,
    },
    {
      code: 'VIP1000',
      discountType: DiscountType.FIXED_AMOUNT,
      discountValue: '1000.00',
      minOrderAmount: '25000.00',
      maxDiscountAmount: null,
      usageLimit: 50,
      usedCount: 12,
      validFrom: daysAgo(60, now),
      validUntil: addDays(now, 120),
      isActive: true,
    },
    {
      code: 'EID25',
      discountType: DiscountType.PERCENTAGE,
      discountValue: '25.00',
      minOrderAmount: '3000.00',
      maxDiscountAmount: '3000.00',
      usageLimit: 500,
      usedCount: 500,
      validFrom: daysAgo(150, now),
      validUntil: daysAgo(120, now),
      isActive: true,
    },
    {
      code: 'WINTER30',
      discountType: DiscountType.PERCENTAGE,
      discountValue: '30.00',
      minOrderAmount: '4000.00',
      maxDiscountAmount: '4000.00',
      usageLimit: 400,
      usedCount: 0,
      validFrom: addDays(now, 45),
      validUntil: addDays(now, 90),
      isActive: true,
    },
    {
      code: 'BKASH150',
      discountType: DiscountType.FIXED_AMOUNT,
      discountValue: '150.00',
      minOrderAmount: '1200.00',
      maxDiscountAmount: null,
      usageLimit: 2000,
      usedCount: 764,
      validFrom: daysAgo(100, now),
      validUntil: addDays(now, 80),
      isActive: false,
    },
  ];
}

export class CouponSeeder implements Seeder {
  readonly name = 'CouponSeeder';
  readonly description = 'Seeds active, expired, scheduled and disabled coupon codes';
  readonly order = 8;

  async seed(prisma: PrismaClient): Promise<void> {
    console.info('🧹 Cleaning "coupons" table...');
    await truncateTable(prisma, 'coupons');

    const coupons = buildCoupons(new Date());
    const count = await insertAll(prisma.coupon, coupons, 'coupons');
    console.info(`✅ Seeded ${count} coupons.`);
  }

  async rollback(prisma: PrismaClient): Promise<void> {
    await truncateTable(prisma, 'coupons');
    console.info('↩️  CouponSeeder rolled back — "coupons" table truncated.');
  }
}
