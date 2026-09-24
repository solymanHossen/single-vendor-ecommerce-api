import {
  PrismaClient,
  OrderStatus,
  Role,
  TicketPriority,
  TicketStatus,
  type Prisma,
} from '@prisma/client';
import { faker } from '@faker-js/faker';
import type { Seeder } from './seeder.interface';
import {
  insertAll,
  resetIdentitySequence,
  truncateTables,
  addDays,
  addHours,
  daysAgo,
  notAfterNow,
} from './seeder.utils';
import { TICKET_SCENARIOS, type TicketScenario } from './data/content.data';
import { DEMO_CUSTOMER_EMAIL } from './user.seeder';

const TOTAL_TICKETS = 48;
const MS_PER_HOUR = 3_600_000;

interface OrderRef {
  readonly id: number;
  readonly userId: number;
  readonly status: OrderStatus;
  readonly createdAt: Date;
}

interface ThreadMessage {
  readonly fromStaff: boolean;
  readonly text: string;
}

/** Payment and damage issues are escalated; pre-sales questions are low priority. */
function priorityFor(scenario: TicketScenario): TicketPriority {
  if (/payment|damaged/i.test(scenario.subject)) {
    return TicketPriority.HIGH;
  }
  if (scenario.orderStatuses) {
    return faker.helpers.weightedArrayElement([
      { weight: 70, value: TicketPriority.MEDIUM },
      { weight: 20, value: TicketPriority.HIGH },
      { weight: 10, value: TicketPriority.LOW },
    ]);
  }
  return faker.datatype.boolean({ probability: 0.8 }) ? TicketPriority.LOW : TicketPriority.MEDIUM;
}

/**
 * Builds the conversation for a given lifecycle stage: an OPEN ticket has
 * only the customer's opening message, IN_PROGRESS has the first staff
 * reply, and a CLOSED ticket carries the full back-and-forth to resolution.
 */
function threadFor(scenario: TicketScenario, status: TicketStatus): ThreadMessage[] {
  const thread: ThreadMessage[] = [{ fromStaff: false, text: scenario.opening }];
  if (status === TicketStatus.OPEN) {
    return thread;
  }

  const [firstReply, ...laterReplies] = scenario.staffReplies;
  const [firstFollowUp, ...laterFollowUps] = scenario.customerFollowUps;
  if (firstReply) {
    thread.push({ fromStaff: true, text: firstReply });
  }
  if (status === TicketStatus.IN_PROGRESS) {
    return thread;
  }

  if (firstFollowUp && laterReplies.length > 0) {
    thread.push({ fromStaff: false, text: firstFollowUp });
  }
  laterReplies.forEach((reply, index) => {
    thread.push({ fromStaff: true, text: reply });
    const followUp = laterFollowUps[index];
    if (followUp) {
      thread.push({ fromStaff: false, text: followUp });
    }
  });
  if (laterReplies.length === 0 && firstFollowUp) {
    thread.push({ fromStaff: false, text: firstFollowUp });
  }
  return thread;
}

export class TicketSeeder implements Seeder {
  readonly name = 'TicketSeeder';
  readonly description = 'Seeds support tickets with realistic customer ↔ staff threads';
  readonly order = 13;

  async seed(prisma: PrismaClient): Promise<void> {
    console.info('🧹 Cleaning "tickets" and "ticket_messages" tables...');
    await truncateTables(prisma, ['ticket_messages', 'tickets']);

    const [customers, admins, orders, demoCustomer] = await Promise.all([
      prisma.user.findMany({
        where: { role: Role.USER, isActive: true, deletedAt: null },
        select: { id: true, createdAt: true },
        orderBy: { id: 'asc' },
      }),
      prisma.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
        select: { id: true },
      }),
      prisma.order.findMany({
        where: { userId: { not: null } },
        select: { id: true, userId: true, status: true, createdAt: true },
        orderBy: { id: 'asc' },
      }),
      prisma.user.findUnique({ where: { email: DEMO_CUSTOMER_EMAIL }, select: { id: true } }),
    ]);

    if (customers.length === 0 || admins.length === 0) {
      throw new Error('TicketSeeder requires seeded customers and staff users.');
    }

    const ordersByStatus = new Map<OrderStatus, OrderRef[]>();
    for (const order of orders) {
      if (order.userId === null) {
        continue;
      }
      const bucket = ordersByStatus.get(order.status) ?? [];
      bucket.push({
        id: order.id,
        userId: order.userId,
        status: order.status,
        createdAt: order.createdAt,
      });
      ordersByStatus.set(order.status, bucket);
    }

    const tickets: Prisma.TicketCreateManyInput[] = [];
    const messages: Prisma.TicketMessageCreateManyInput[] = [];
    const usedOrderIds = new Set<number>();
    const now = new Date();

    for (let index = 0; index < TOTAL_TICKETS; index++) {
      // Cycle through scenarios so every support topic is represented.
      const scenario = TICKET_SCENARIOS[index % TICKET_SCENARIOS.length];
      if (!scenario) {
        continue;
      }

      let userId: number;
      let orderId: number | null = null;
      let createdAt: Date;

      if (scenario.orderStatuses) {
        const candidates = scenario.orderStatuses
          .flatMap((status) => ordersByStatus.get(status) ?? [])
          .filter((order) => !usedOrderIds.has(order.id));
        // Prefer the demo customer's orders for their first few tickets.
        const demoCandidates = candidates.filter((order) => order.userId === demoCustomer?.id);
        const order =
          index < TICKET_SCENARIOS.length && demoCandidates.length > 0
            ? faker.helpers.arrayElement(demoCandidates)
            : candidates.length > 0
              ? faker.helpers.arrayElement(candidates)
              : undefined;
        if (!order) {
          continue;
        }
        usedOrderIds.add(order.id);
        userId = order.userId;
        orderId = order.id;
        createdAt = notAfterNow(addHours(order.createdAt, faker.number.float({ min: 1, max: 72 })));
      } else {
        const customer = faker.helpers.arrayElement(customers);
        userId = customer.id;
        const from =
          customer.createdAt > daysAgo(120, now) ? customer.createdAt : daysAgo(120, now);
        createdAt = faker.date.between({ from, to: now });
      }

      const ageHours = (now.getTime() - createdAt.getTime()) / MS_PER_HOUR;
      const status =
        ageHours < 12
          ? TicketStatus.OPEN
          : ageHours < 72
            ? faker.helpers.arrayElement([TicketStatus.OPEN, TicketStatus.IN_PROGRESS])
            : faker.helpers.weightedArrayElement([
                { weight: 78, value: TicketStatus.CLOSED },
                { weight: 22, value: TicketStatus.IN_PROGRESS },
              ]);

      const ticketId = tickets.length + 1;
      const staffId = faker.helpers.arrayElement(admins).id;
      let messageAt = createdAt;

      for (const [position, message] of threadFor(scenario, status).entries()) {
        if (position > 0) {
          messageAt = notAfterNow(
            addHours(messageAt, faker.number.float({ min: 0.25, max: message.fromStaff ? 8 : 20 })),
          );
        }
        messages.push({
          ticketId,
          senderId: message.fromStaff ? staffId : userId,
          message: message.text,
          createdAt: messageAt,
        });
      }

      tickets.push({
        id: ticketId,
        userId,
        orderId,
        subject: scenario.subject,
        status,
        priority: priorityFor(scenario),
        createdAt,
        updatedAt:
          status === TicketStatus.CLOSED
            ? notAfterNow(addDays(messageAt, faker.number.float({ min: 0, max: 1 })))
            : messageAt,
      });
    }

    await insertAll(prisma.ticket, tickets, 'tickets');
    await insertAll(prisma.ticketMessage, messages, 'ticket_messages');
    await resetIdentitySequence(prisma, 'tickets');

    console.info(`✅ Seeded ${tickets.length} tickets with ${messages.length} messages.`);
  }

  async rollback(prisma: PrismaClient): Promise<void> {
    await truncateTables(prisma, ['ticket_messages', 'tickets']);
    console.info('↩️  TicketSeeder rolled back.');
  }
}
