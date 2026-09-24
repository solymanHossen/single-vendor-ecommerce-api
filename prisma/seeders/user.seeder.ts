import { PrismaClient, Role, type Prisma } from '@prisma/client';
import { faker } from '@faker-js/faker';
import type { Seeder } from './seeder.interface';
import { truncateTable, seedInChunks, daysAgo } from './seeder.utils';
import { FIRST_NAMES, LAST_NAMES, MOBILE_PREFIXES } from './data/people.data';

/** Well-known demo customer — has orders, reviews, wishlist and tickets seeded. */
export const DEMO_CUSTOMER_EMAIL = 'customer@example.com';

export class UserSeeder implements Seeder {
  readonly name = 'UserSeeder';
  readonly description =
    'Seeds one SUPER_ADMIN, five ADMINs, a demo customer and the remaining regular USERs';
  readonly order = 1;

  // Pre-hashed bcrypt value for 'Password123' at cost 10.
  // Avoids CPU-bound hashing during seed runs. Verified to actually match
  // its documented plaintext via bcrypt.compareSync — the previous constant
  // here did not (it was some other, undocumented string's hash) and every
  // seeded account was silently unloggable-into as a result.
  // WARNING: This is a development-only seed password — never derive real
  // user passwords from this hash, and never run seeders in production.
  private static readonly PRE_HASHED_PASSWORD =
    '$2b$10$soVlmc/dt0o.3Mz.5JJuVu8GBYkwu30gXgRvCVuQ7oeJUNzSOk7AC';

  private static readonly TOTAL_USERS = 60;

  async seed(prisma: PrismaClient): Promise<void> {
    console.info('🧹 Cleaning "users" table...');
    await truncateTable(prisma, 'users');

    const users: Prisma.UserCreateManyInput[] = [];

    users.push({
      email: 'superadmin@example.com',
      name: 'Super Admin',
      phone: UserSeeder.mobileNumber(),
      password: UserSeeder.PRE_HASHED_PASSWORD,
      role: Role.SUPER_ADMIN,
      isActive: true,
      createdAt: daysAgo(400),
    });

    for (let i = 1; i <= 5; i++) {
      users.push({
        email: `admin${i}@example.com`,
        name: `Admin User ${i}`,
        phone: UserSeeder.mobileNumber(),
        password: UserSeeder.PRE_HASHED_PASSWORD,
        role: Role.ADMIN,
        isActive: true,
        createdAt: daysAgo(faker.number.int({ min: 300, max: 390 })),
      });
    }

    users.push({
      email: DEMO_CUSTOMER_EMAIL,
      name: 'Nusrat Jahan',
      phone: '01711000000',
      avatarUrl: UserSeeder.avatarUrl(1),
      password: UserSeeder.PRE_HASHED_PASSWORD,
      role: Role.USER,
      isActive: true,
      createdAt: daysAgo(240),
    });

    const remaining = UserSeeder.TOTAL_USERS - users.length;
    for (let i = 0; i < remaining; i++) {
      const firstName = faker.helpers.arrayElement(FIRST_NAMES);
      const lastName = faker.helpers.arrayElement(LAST_NAMES);

      users.push({
        // Index suffix guarantees uniqueness even when two customers
        // happen to share the same first + last name.
        email: `${firstName}.${lastName}${i + 1}@example.com`.toLowerCase(),
        name: `${firstName} ${lastName}`,
        phone: UserSeeder.mobileNumber(),
        // ~80% of customers upload a profile photo.
        avatarUrl: faker.datatype.boolean({ probability: 0.8 })
          ? UserSeeder.avatarUrl(i + 2)
          : null,
        password: UserSeeder.PRE_HASHED_PASSWORD,
        role: Role.USER,
        isActive: faker.datatype.boolean({ probability: 0.95 }),
        createdAt: faker.date.between({ from: daysAgo(365), to: daysAgo(3) }),
      });
    }

    console.info(`📦 Inserting ${users.length} users in chunks...`);
    const count = await seedInChunks(prisma.user, users, 5_000);
    console.info(`✅ Successfully seeded ${count} users.`);
  }

  async rollback(prisma: PrismaClient): Promise<void> {
    await truncateTable(prisma, 'users');
    console.info('↩️  UserSeeder rolled back — "users" table truncated.');
  }

  /** 11-digit Bangladeshi mobile number, e.g. 01712345678. */
  private static mobileNumber(): string {
    return `${faker.helpers.arrayElement(MOBILE_PREFIXES)}${faker.string.numeric(8)}`;
  }

  /** pravatar.cc serves 70 stable portrait photos, addressed by index. */
  private static avatarUrl(index: number): string {
    return `https://i.pravatar.cc/300?img=${(index % 70) + 1}`;
  }
}
