import { PrismaClient, OrderStatus, ReturnStatus, type Prisma } from '@prisma/client';
import { faker } from '@faker-js/faker';
import type { Seeder } from './seeder.interface';
import { insertAll, truncateTable, addDays, daysAgo, notAfterNow } from './seeder.utils';
import {
  RETURN_APPROVED_NOTES,
  RETURN_REASONS,
  RETURN_REFUNDED_NOTES,
  RETURN_REJECTED_NOTES,
} from './data/content.data';

export class ReturnRequestSeeder implements Seeder {
  readonly name = 'ReturnRequestSeeder';
  readonly description =
    'Seeds return requests for returned orders plus pending/rejected ones on delivered orders';
  readonly order = 12;

  async seed(prisma: PrismaClient): Promise<void> {
    console.info('🧹 Cleaning "return_requests" table...');
    await truncateTable(prisma, 'return_requests');

    const orders = await prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.RETURNED, OrderStatus.DELIVERED] },
        userId: { not: null },
      },
      select: { id: true, userId: true, status: true, createdAt: true, updatedAt: true },
      orderBy: { id: 'asc' },
    });

    const requests: Prisma.ReturnRequestCreateManyInput[] = [];
    const recentDeliveryCutoff = daysAgo(10);

    for (const order of orders) {
      if (order.userId === null) {
        continue;
      }

      let status: ReturnStatus;
      if (order.status === OrderStatus.RETURNED) {
        // A RETURNED order's request has completed the whole workflow.
        status = faker.helpers.weightedArrayElement([
          { weight: 80, value: ReturnStatus.REFUNDED },
          { weight: 20, value: ReturnStatus.APPROVED },
        ]);
      } else if (order.updatedAt > recentDeliveryCutoff) {
        // Recently delivered — a few customers have just opened a request.
        if (!faker.datatype.boolean({ probability: 0.18 })) {
          continue;
        }
        status = ReturnStatus.PENDING;
      } else {
        // Older delivered orders that are still DELIVERED had their request declined.
        if (!faker.datatype.boolean({ probability: 0.04 })) {
          continue;
        }
        status = ReturnStatus.REJECTED;
      }

      const deliveredAt =
        order.status === OrderStatus.RETURNED
          ? addDays(order.createdAt, faker.number.float({ min: 2, max: 5 }))
          : order.updatedAt;
      const createdAt = notAfterNow(addDays(deliveredAt, faker.number.float({ min: 0.2, max: 4 })));
      const resolvedAt =
        status === ReturnStatus.PENDING
          ? createdAt
          : notAfterNow(addDays(createdAt, faker.number.float({ min: 0.5, max: 3 })));

      requests.push({
        orderId: order.id,
        userId: order.userId,
        reason: faker.helpers.arrayElement(RETURN_REASONS),
        status,
        adminNote: this.adminNoteFor(status),
        createdAt,
        updatedAt: resolvedAt,
      });
    }

    const count = await insertAll(prisma.returnRequest, requests, 'return_requests');
    console.info(`✅ Seeded ${count} return requests.`);
  }

  async rollback(prisma: PrismaClient): Promise<void> {
    await truncateTable(prisma, 'return_requests');
    console.info('↩️  ReturnRequestSeeder rolled back — "return_requests" table truncated.');
  }

  private adminNoteFor(status: ReturnStatus): string | null {
    switch (status) {
      case ReturnStatus.PENDING:
        return null;
      case ReturnStatus.APPROVED:
        return faker.helpers.arrayElement(RETURN_APPROVED_NOTES);
      case ReturnStatus.REFUNDED:
        return faker.helpers.arrayElement(RETURN_REFUNDED_NOTES);
      case ReturnStatus.REJECTED:
        return faker.helpers.arrayElement(RETURN_REJECTED_NOTES);
    }
  }
}
