import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { UserSeeder } from './seeders/user.seeder';
import { AppSettingSeeder } from './seeders/app-setting.seeder';
import { HeroBannerSeeder } from './seeders/hero-banner.seeder';
import { AddressSeeder } from './seeders/address.seeder';
import { CategorySeeder } from './seeders/category.seeder';
import { AttributeSeeder } from './seeders/attribute.seeder';
import { ProductSeeder } from './seeders/product.seeder';
import { CouponSeeder } from './seeders/coupon.seeder';
import { OrderSeeder } from './seeders/order.seeder';
import { ReviewSeeder } from './seeders/review.seeder';
import { WishlistSeeder } from './seeders/wishlist.seeder';
import { ReturnRequestSeeder } from './seeders/return-request.seeder';
import { TicketSeeder } from './seeders/ticket.seeder';
import type { Seeder } from './seeders/seeder.interface';

// ── Environment guard (deny-by-default) ───────────────────────────────────────
// TRUNCATE + CASCADE inside each seeder will wipe all seeded tables.
// Deny-by-default: only explicitly allow-listed NODE_ENV values may seed.
// This catches misconfigured envs ('prod', 'PRODUCTION', 'staging', unset)
// that would bypass a simple === 'production' check.
const SEEDING_ALLOWED_ENVS = new Set(['development', 'test']);
if (!SEEDING_ALLOWED_ENVS.has(process.env.NODE_ENV ?? '')) {
  console.error(
    `❌ Seeding is blocked in this environment.\n` +
      `   Current NODE_ENV: "${process.env.NODE_ENV ?? '(unset)'}"\n` +
      `   Seeding is only permitted when NODE_ENV is "development" or "test".`,
  );
  process.exit(1);
}

// ── DATABASE_URL validation ────────────────────────────────────────────────────
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error(
    '❌ DATABASE_URL is not defined.\n' +
      '   Ensure your .env file exists and contains a valid DATABASE_URL.',
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  // Seed pool is intentionally smaller than the app pool — seeding is a
  // single-process, sequential workload that does not need high concurrency.
  max: 5,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── Deterministic data ─────────────────────────────────────────────────────────
// A fixed faker seed makes every run produce the same catalog, customers and
// order graph (only timestamps shift, since they are relative to "now"), so
// screenshots, e2e fixtures and bug reproductions stay stable across machines.
// Override with SEED_RANDOM=<integer> to explore a different dataset.
const DEFAULT_FAKER_SEED = 20260924;
const fakerSeed = Number.parseInt(process.env.SEED_RANDOM ?? '', 10);
faker.seed(Number.isFinite(fakerSeed) ? fakerSeed : DEFAULT_FAKER_SEED);

async function printSummary(): Promise<void> {
  const counts = await prisma.$transaction([
    prisma.user.count(),
    prisma.address.count(),
    prisma.category.count(),
    prisma.attribute.count(),
    prisma.attributeOption.count(),
    prisma.product.count(),
    prisma.productImage.count(),
    prisma.productVariant.count(),
    prisma.coupon.count(),
    prisma.order.count(),
    prisma.orderItem.count(),
    prisma.payment.count(),
    prisma.review.count(),
    prisma.reviewReply.count(),
    prisma.wishlist.count(),
    prisma.returnRequest.count(),
    prisma.ticket.count(),
    prisma.ticketMessage.count(),
    prisma.heroBanner.count(),
  ]);
  const labels = [
    'users',
    'addresses',
    'categories',
    'attributes',
    'attribute options',
    'products',
    'product images',
    'product variants',
    'coupons',
    'orders',
    'order items',
    'payments',
    'reviews',
    'review replies',
    'wishlist entries',
    'return requests',
    'tickets',
    'ticket messages',
    'hero banners',
  ];

  console.info('\n📊 Seeded dataset summary');
  console.table(Object.fromEntries(labels.map((label, index) => [label, counts[index] ?? 0])));
  console.info('🔑 Logins (password: Password123):');
  console.info('   superadmin@example.com · admin1@example.com · customer@example.com');
}

async function main(): Promise<void> {
  console.info('🌱 Starting Database Seeding...');
  const startTime = performance.now();

  // Register seeders, then sort by their declared `order` so that dependency
  // order is respected regardless of array registration sequence.
  // Seeders without an `order` value are sorted to the end.
  const seeders: Seeder[] = [
    new UserSeeder(),
    new AppSettingSeeder(),
    new HeroBannerSeeder(),
    new AddressSeeder(),
    new CategorySeeder(),
    new AttributeSeeder(),
    new ProductSeeder(),
    new CouponSeeder(),
    new OrderSeeder(),
    new ReviewSeeder(),
    new WishlistSeeder(),
    new ReturnRequestSeeder(),
    new TicketSeeder(),
  ];
  seeders.sort(
    (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER),
  );

  for (const seeder of seeders) {
    console.info(`\n▶️  Running seeder: ${seeder.name}`);
    if (seeder.description) {
      console.info(`    ${seeder.description}`);
    }

    const seederStart = performance.now();
    await seeder.seed(prisma);
    const seederMs = performance.now() - seederStart;

    console.info(`⏹️  Finished ${seeder.name} in ${(seederMs / 1000).toFixed(2)}s`);
  }

  await printSummary();

  const totalMs = performance.now() - startTime;
  console.info(`\n🎉 Database seeding completed in ${(totalMs / 1000).toFixed(2)}s`);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Seeding failed: ${message}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
