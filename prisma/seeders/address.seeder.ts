import { PrismaClient, Role, type Prisma } from '@prisma/client';
import { faker } from '@faker-js/faker';
import type { Seeder } from './seeder.interface';
import { insertAll, truncateTable } from './seeder.utils';
import { LOCATIONS } from './data/people.data';

const ADDRESS_LINE2_OPTIONS = [
  'Flat 3B',
  'Flat 5A, Lift 4',
  'Level 6',
  'Near Central Mosque',
  'Opposite City Bank',
  'Behind Agora Super Shop',
] as const;

export class AddressSeeder implements Seeder {
  readonly name = 'AddressSeeder';
  readonly description = 'Seeds 1–3 Bangladeshi shipping addresses per customer (first is default)';
  readonly order = 4;

  async seed(prisma: PrismaClient): Promise<void> {
    console.info('🧹 Cleaning "addresses" table...');
    await truncateTable(prisma, 'addresses');

    const customers = await prisma.user.findMany({
      where: { role: Role.USER },
      select: { id: true, name: true, phone: true, createdAt: true },
      orderBy: { id: 'asc' },
    });

    const addresses: Prisma.AddressCreateManyInput[] = [];

    for (const customer of customers) {
      const count = faker.helpers.weightedArrayElement([
        { weight: 60, value: 1 },
        { weight: 30, value: 2 },
        { weight: 10, value: 3 },
      ]);
      const locations = faker.helpers.arrayElements(LOCATIONS, count);

      locations.forEach((location, index) => {
        const createdAt = faker.date.between({ from: customer.createdAt, to: new Date() });

        addresses.push({
          userId: customer.id,
          recipientName: customer.name,
          phone: customer.phone,
          addressLine1: `House ${faker.number.int({ min: 1, max: 120 })}, Road ${faker.number.int({ min: 1, max: 32 })}, ${location.area}`,
          addressLine2: faker.datatype.boolean({ probability: 0.55 })
            ? faker.helpers.arrayElement(ADDRESS_LINE2_OPTIONS)
            : null,
          city: location.city,
          state: location.division,
          postalCode: location.postalCode,
          country: 'Bangladesh',
          isDefault: index === 0,
          createdAt,
          updatedAt: createdAt,
        });
      });
    }

    const count = await insertAll(prisma.address, addresses, 'addresses');
    console.info(`✅ Seeded ${count} addresses for ${customers.length} customers.`);
  }

  async rollback(prisma: PrismaClient): Promise<void> {
    await truncateTable(prisma, 'addresses');
    console.info('↩️  AddressSeeder rolled back — "addresses" table truncated.');
  }
}
