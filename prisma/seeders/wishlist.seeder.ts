import { PrismaClient, Role, type Prisma } from '@prisma/client';
import { faker } from '@faker-js/faker';
import type { Seeder } from './seeder.interface';
import { insertAll, truncateTable } from './seeder.utils';
import { DEMO_CUSTOMER_EMAIL } from './user.seeder';

export class WishlistSeeder implements Seeder {
  readonly name = 'WishlistSeeder';
  readonly description = 'Seeds customer wishlists with published products';
  readonly order = 11;

  async seed(prisma: PrismaClient): Promise<void> {
    console.info('🧹 Cleaning "wishlists" table...');
    await truncateTable(prisma, 'wishlists');

    const [customers, products] = await Promise.all([
      prisma.user.findMany({
        where: { role: Role.USER, isActive: true, deletedAt: null },
        select: { id: true, email: true, createdAt: true },
        orderBy: { id: 'asc' },
      }),
      prisma.product.findMany({
        where: { isPublished: true },
        select: { id: true, createdAt: true },
        orderBy: { id: 'asc' },
      }),
    ]);

    const wishlists: Prisma.WishlistCreateManyInput[] = [];

    for (const customer of customers) {
      // The demo account always has a populated wishlist to showcase the page.
      const size =
        customer.email === DEMO_CUSTOMER_EMAIL
          ? 6
          : faker.helpers.weightedArrayElement([
              { weight: 20, value: 0 },
              { weight: 45, value: faker.number.int({ min: 1, max: 4 }) },
              { weight: 35, value: faker.number.int({ min: 5, max: 9 }) },
            ]);

      // arrayElements samples without replacement, satisfying @@unique([userId, productId]).
      for (const product of faker.helpers.arrayElements(products, size)) {
        const from =
          product.createdAt > customer.createdAt ? product.createdAt : customer.createdAt;
        wishlists.push({
          userId: customer.id,
          productId: product.id,
          createdAt: faker.date.between({ from, to: new Date() }),
        });
      }
    }

    const count = await insertAll(prisma.wishlist, wishlists, 'wishlists');
    console.info(`✅ Seeded ${count} wishlist entries across ${customers.length} customers.`);
  }

  async rollback(prisma: PrismaClient): Promise<void> {
    await truncateTable(prisma, 'wishlists');
    console.info('↩️  WishlistSeeder rolled back — "wishlists" table truncated.');
  }
}
