import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TicketMessageKind, TicketStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { CATEGORY_PRIORITY, DONE_STATUSES } from './tickets.constants';
import { CreateTicketDto } from './dto/create-ticket.dto';
import type { CreateTicketMessageDto, RateTicketDto } from './dto/create-ticket-message.dto';
import { TicketQueryDto } from './dto/query-ticket.dto';
import {
  PaginatedTicketsEntity,
  PaginationMetaEntity,
  TicketDetailEntity,
} from './entities/ticket.entity';
import {
  TICKET_DETAIL_SELECT,
  TICKET_LIST_SELECT,
  threadQuery,
  toDetail,
  toListItem,
} from './tickets.mapper';

/**
 * The customer's side of support: their own requests only, never staff
 * notes or internal events. Staff work the queue through AdminTicketsService.
 */
@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthUser, dto: CreateTicketDto): Promise<TicketDetailEntity> {
    if (dto.orderId !== undefined) {
      const order = await this.prisma.order.findFirst({
        where: { id: dto.orderId, userId: user.id },
        select: { id: true },
      });
      if (!order) throw new NotFoundException('Order does not exist for the current user.');
    }

    const now = new Date();
    const ticket = await this.prisma.ticket.create({
      data: {
        userId: user.id,
        orderId: dto.orderId,
        category: dto.category,
        subject: dto.subject,
        priority: CATEGORY_PRIORITY[dto.category],
        awaitingStaff: true,
        lastMessageAt: now,
        customerReadAt: now,
        messages: {
          create: [{ senderId: user.id, message: dto.message, attachments: dto.attachments }],
        },
      },
      select: { id: true },
    });

    return this.detail(user.id, ticket.id);
  }

  async findAll(user: AuthUser, query: TicketQueryDto): Promise<PaginatedTicketsEntity> {
    const where: Prisma.TicketWhereInput = { userId: user.id };
    if (query.state === 'active') where.status = { notIn: [...DONE_STATUSES] };
    if (query.state === 'resolved') where.status = { in: [...DONE_STATUSES] };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        select: TICKET_LIST_SELECT,
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return new PaginatedTicketsEntity({
      items: rows.map((row) => toListItem(row, 'customer')),
      meta: new PaginationMetaEntity({
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      }),
    });
  }

  /** Requests with a staff reply the customer hasn't opened — the nav badge. */
  async unreadCount(userId: number): Promise<number> {
    return this.prisma.ticket.count({
      where: {
        userId,
        lastStaffReplyAt: { not: null },
        OR: [
          { customerReadAt: null },
          { lastStaffReplyAt: { gt: this.prisma.ticket.fields.customerReadAt } },
        ],
      },
    });
  }

  /** Opening the thread marks staff replies as read. */
  async findOne(user: AuthUser, id: number): Promise<TicketDetailEntity> {
    const updated = await this.prisma.ticket.updateMany({
      where: { id, userId: user.id },
      data: { customerReadAt: new Date() },
    });
    if (updated.count === 0) throw new NotFoundException('Ticket does not exist.');
    return this.detail(user.id, id);
  }

  async addMessage(
    user: AuthUser,
    id: number,
    dto: CreateTicketMessageDto,
  ): Promise<TicketDetailEntity> {
    const ticket = await this.own(user.id, id);
    if (ticket.status === TicketStatus.CLOSED) {
      throw new ConflictException(
        'This request is closed. Start a new one if you still need help — we’ll link it up.',
      );
    }

    const now = new Date();
    const reopening = ticket.status === TicketStatus.RESOLVED;
    await this.prisma.$transaction([
      ...(reopening ? [this.event(id, user.id, 'reopened this request', now)] : []),
      this.prisma.ticketMessage.create({
        data: {
          ticketId: id,
          senderId: user.id,
          message: dto.message,
          attachments: dto.attachments,
          // Keep the event first when both land in the same millisecond.
          createdAt: new Date(now.getTime() + 1),
        },
        select: { id: true },
      }),
      this.prisma.ticket.update({
        where: { id },
        data: {
          // The customer answered: back in the staff queue.
          status:
            ticket.status === TicketStatus.WAITING || reopening ? TicketStatus.OPEN : ticket.status,
          awaitingStaff: true,
          resolvedAt: null,
          lastMessageAt: now,
          customerReadAt: now,
        },
        select: { id: true },
      }),
    ]);

    return this.detail(user.id, id);
  }

  async resolve(user: AuthUser, id: number): Promise<TicketDetailEntity> {
    const ticket = await this.own(user.id, id);
    if (DONE_STATUSES.includes(ticket.status)) return this.detail(user.id, id);

    const now = new Date();
    await this.prisma.$transaction([
      this.event(id, user.id, 'marked this as resolved', now),
      this.prisma.ticket.update({
        where: { id },
        data: { status: TicketStatus.RESOLVED, awaitingStaff: false, resolvedAt: now },
        select: { id: true },
      }),
    ]);
    return this.detail(user.id, id);
  }

  async rate(user: AuthUser, id: number, dto: RateTicketDto): Promise<TicketDetailEntity> {
    const ticket = await this.own(user.id, id);
    if (!DONE_STATUSES.includes(ticket.status)) {
      throw new BadRequestException('You can rate a request once it’s resolved.');
    }
    await this.prisma.ticket.update({
      where: { id },
      data: { satisfied: dto.satisfied },
      select: { id: true },
    });
    return this.detail(user.id, id);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async own(userId: number, id: number) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, userId },
      select: { id: true, status: true },
    });
    if (!ticket) throw new NotFoundException('Ticket does not exist.');
    return ticket;
  }

  private async detail(userId: number, id: number): Promise<TicketDetailEntity> {
    const [row, thread] = await Promise.all([
      this.prisma.ticket.findFirst({ where: { id, userId }, select: TICKET_DETAIL_SELECT }),
      this.prisma.ticketMessage.findMany(threadQuery(id, 'customer')),
    ]);
    if (!row) throw new NotFoundException('Ticket does not exist.');
    return toDetail(row, thread, 'customer');
  }

  /** A public timeline entry; the UI prefixes the sender: "Nusrat reopened this request". */
  private event(ticketId: number, senderId: number, message: string, at: Date) {
    return this.prisma.ticketMessage.create({
      data: { ticketId, senderId, kind: TicketMessageKind.EVENT, message, createdAt: at },
      select: { id: true },
    });
  }
}
