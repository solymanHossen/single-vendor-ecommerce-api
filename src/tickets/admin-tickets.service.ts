import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role, TicketMessageKind, TicketStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { effectivePermissions } from '../access/permissions';
import {
  AUTO_CLOSE_AFTER_DAYS,
  CATEGORY_LABEL,
  DONE_STATUSES,
  PRIORITY_LABEL,
  TICKET_VIEWS,
  type TicketView,
} from './tickets.constants';
import type { AdminTicketQueryDto } from './dto/query-ticket.dto';
import type { StaffTicketMessageDto } from './dto/create-ticket-message.dto';
import type { UpdateTicketDto } from './dto/update-ticket.dto';
import {
  PaginatedTicketsEntity,
  PaginationMetaEntity,
  TicketCustomerStatsEntity,
  TicketDetailEntity,
  TicketPersonEntity,
  TicketSummaryEntity,
} from './entities/ticket.entity';
import {
  TICKET_DETAIL_SELECT,
  TICKET_LIST_SELECT,
  threadQuery,
  toDetail,
  toListItem,
} from './tickets.mapper';

const NOT_DONE = { status: { notIn: [...DONE_STATUSES] } } satisfies Prisma.TicketWhereInput;
const DAY = 86_400_000;

/** Public wording of a status change, prefixed in the UI by who made it. */
const STATUS_EVENT: Record<TicketStatus, string> = {
  OPEN: 'reopened this request',
  IN_PROGRESS: 'started working on this',
  WAITING: 'is waiting for a reply from the customer',
  RESOLVED: 'marked this as resolved',
  CLOSED: 'closed this request',
};

type EventInput = { message: string; isInternal: boolean };

/**
 * The staff side of support. Every write keeps the queue fields
 * (awaitingStaff, lastMessageAt, …) consistent and leaves a timeline entry.
 */
@Injectable()
export class AdminTicketsService {
  private readonly logger = new Logger(AdminTicketsService.name);
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    configService: ConfigService,
  ) {
    const port = configService.get<number>('PORT') ?? 3000;
    this.appUrl = (configService.get<string>('APP_URL') ?? `http://localhost:${port}`).replace(
      /\/+$/,
      '',
    );
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  async findAll(actor: AuthUser, query: AdminTicketQueryDto): Promise<PaginatedTicketsEntity> {
    const where: Prisma.TicketWhereInput = {
      ...this.viewWhere(query.view, actor.id),
      ...(query.priority && { priority: query.priority }),
      ...(query.category && { category: query.category }),
      ...(query.userId && { userId: query.userId }),
    };
    if (query.search) {
      const term = query.search.replace(/^#/, '');
      const asId = /^\d{1,9}$/.test(term) ? Number(term) : null;
      where.OR = [
        { subject: { contains: term, mode: 'insensitive' } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
        { user: { name: { contains: term, mode: 'insensitive' } } },
        ...(asId !== null ? [{ id: asId }, { orderId: asId }] : []),
      ];
    }

    // The reply queue is worked most-urgent, longest-waiting first.
    const orderBy: Prisma.TicketOrderByWithRelationInput[] =
      query.view === 'needs_reply'
        ? [{ priority: 'desc' }, { lastMessageAt: 'asc' }, { id: 'asc' }]
        : [{ lastMessageAt: 'desc' }, { id: 'desc' }];

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        select: TICKET_LIST_SELECT,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return new PaginatedTicketsEntity({
      items: rows.map((row) => toListItem(row, 'staff')),
      meta: new PaginationMetaEntity({
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      }),
    });
  }

  async summary(actor: AuthUser, now: Date = new Date()): Promise<TicketSummaryEntity> {
    const [counts, openCount, response, ratings] = await Promise.all([
      this.prisma.$transaction(
        TICKET_VIEWS.map((view) =>
          this.prisma.ticket.count({ where: this.viewWhere(view, actor.id) }),
        ),
      ),
      this.prisma.ticket.count({ where: NOT_DONE }),
      this.prisma.$queryRaw<Array<{ minutes: number | null }>>`
        SELECT (AVG(EXTRACT(EPOCH FROM first_response_at - created_at)) / 60)::float AS minutes
        FROM tickets
        WHERE first_response_at IS NOT NULL AND created_at >= ${new Date(now.getTime() - 30 * DAY)}`,
      this.prisma.ticket.groupBy({
        by: ['satisfied'],
        where: {
          satisfied: { not: null },
          resolvedAt: { gte: new Date(now.getTime() - 90 * DAY) },
        },
        _count: { _all: true },
      }),
    ]);

    const rated = ratings.reduce((sum, group) => sum + group._count._all, 0);
    const happy = ratings.find((group) => group.satisfied === true)?._count._all ?? 0;
    const minutes = response[0]?.minutes ?? null;

    return new TicketSummaryEntity({
      views: Object.fromEntries(TICKET_VIEWS.map((view, i) => [view, counts[i]])) as Record<
        TicketView,
        number
      >,
      openCount,
      avgFirstResponseMinutes: minutes === null ? null : Math.round(minutes),
      satisfactionRate: rated === 0 ? null : happy / rated,
      ratedCount: rated,
    });
  }

  async findOne(id: number): Promise<TicketDetailEntity> {
    const [row, thread] = await Promise.all([
      this.prisma.ticket.findUnique({ where: { id }, select: TICKET_DETAIL_SELECT }),
      this.prisma.ticketMessage.findMany(threadQuery(id, 'staff')),
    ]);
    if (!row) throw new NotFoundException('Ticket does not exist.');

    const [orderCount, ticketCount] = await Promise.all([
      this.prisma.order.count({ where: { userId: row.userId } }),
      this.prisma.ticket.count({ where: { userId: row.userId } }),
    ]);

    return toDetail(
      row,
      thread,
      'staff',
      new TicketCustomerStatsEntity({ orderCount, ticketCount, memberSince: row.user.createdAt }),
    );
  }

  /** Staff who can be assigned tickets (they have tickets.manage). */
  async assignees(): Promise<TicketPersonEntity[]> {
    const staff = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        staffRole: { select: { permissions: true } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return staff
      .filter((user) =>
        effectivePermissions(user.role, user.staffRole?.permissions).includes('tickets.manage'),
      )
      .map(
        (user) =>
          new TicketPersonEntity({
            id: user.id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
          }),
      );
  }

  // ── Writes ────────────────────────────────────────────────────────────────

  async reply(
    actor: AuthUser,
    id: number,
    dto: StaffTicketMessageDto,
  ): Promise<TicketDetailEntity> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        subject: true,
        assigneeId: true,
        firstResponseAt: true,
        user: { select: { email: true, name: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket does not exist.');

    const now = new Date();
    // Stable ordering for entries written in the same request.
    const at = (offset: number) => new Date(now.getTime() + offset);

    if (dto.internal) {
      await this.prisma.ticketMessage.create({
        data: {
          ticketId: id,
          senderId: actor.id,
          kind: TicketMessageKind.NOTE,
          isInternal: true,
          message: dto.message,
          attachments: dto.attachments,
        },
        select: { id: true },
      });
      return this.findOne(id);
    }

    const next = dto.status ?? TicketStatus.WAITING;
    const takesIt = ticket.assigneeId === null;
    await this.prisma.$transaction([
      ...(takesIt
        ? [this.event(id, actor.id, { message: 'took this request', isInternal: true }, at(0))]
        : []),
      this.prisma.ticketMessage.create({
        data: {
          ticketId: id,
          senderId: actor.id,
          message: dto.message,
          attachments: dto.attachments,
          createdAt: at(1),
        },
        select: { id: true },
      }),
      ...(next === TicketStatus.RESOLVED
        ? [this.event(id, actor.id, { message: STATUS_EVENT.RESOLVED, isInternal: false }, at(2))]
        : []),
      this.prisma.ticket.update({
        where: { id },
        data: {
          status: next,
          awaitingStaff: false,
          lastMessageAt: at(1),
          lastStaffReplyAt: at(1),
          firstResponseAt: ticket.firstResponseAt ?? at(1),
          resolvedAt: next === TicketStatus.RESOLVED ? at(2) : null,
          ...(takesIt && { assigneeId: actor.id }),
        },
        select: { id: true },
      }),
    ]);

    // Best effort: a mail outage must not fail a reply that's already saved.
    this.mail
      .sendTicketReplyEmail({
        to: ticket.user.email,
        name: ticket.user.name,
        ticketId: id,
        subject: ticket.subject,
        excerpt: dto.message.length > 600 ? `${dto.message.slice(0, 599)}…` : dto.message,
        url: `${this.appUrl}/dashboard/support/${id}`,
      })
      .catch((error: unknown) =>
        this.logger.warn(`Ticket #${id} reply email failed: ${String(error)}`),
      );

    return this.findOne(id);
  }

  async update(actor: AuthUser, id: number, dto: UpdateTicketDto): Promise<TicketDetailEntity> {
    const current = await this.prisma.ticket.findUnique({
      where: { id },
      select: { status: true, priority: true, category: true, assigneeId: true },
    });
    if (!current) throw new NotFoundException('Ticket does not exist.');

    const data: Prisma.TicketUncheckedUpdateInput = {};
    const events: EventInput[] = [];
    const now = new Date();

    if (dto.status !== undefined && dto.status !== current.status) {
      data.status = dto.status;
      data.awaitingStaff =
        dto.status === TicketStatus.OPEN || dto.status === TicketStatus.IN_PROGRESS;
      data.resolvedAt = DONE_STATUSES.includes(dto.status) ? now : null;
      events.push({ message: STATUS_EVENT[dto.status], isInternal: false });
    }
    if (dto.priority !== undefined && dto.priority !== current.priority) {
      data.priority = dto.priority;
      events.push({
        message: `set the priority to ${PRIORITY_LABEL[dto.priority]}`,
        isInternal: true,
      });
    }
    if (dto.category !== undefined && dto.category !== current.category) {
      data.category = dto.category;
      events.push({ message: `moved this to ${CATEGORY_LABEL[dto.category]}`, isInternal: true });
    }
    if (dto.assigneeId !== undefined && dto.assigneeId !== current.assigneeId) {
      if (dto.assigneeId === null) {
        events.push({ message: 'unassigned this request', isInternal: true });
      } else {
        const assignee = (await this.assignees()).find((user) => user.id === dto.assigneeId);
        if (!assignee) {
          throw new BadRequestException("That person can't be assigned support requests.");
        }
        events.push({
          message:
            assignee.id === actor.id
              ? 'took this request'
              : `assigned this to ${assignee.name ?? assignee.email ?? 'a teammate'}`,
          isInternal: true,
        });
      }
      data.assigneeId = dto.assigneeId;
    }

    if (events.length > 0) {
      await this.prisma.$transaction([
        ...events.map((event, index) =>
          this.event(id, actor.id, event, new Date(now.getTime() + index)),
        ),
        this.prisma.ticket.update({ where: { id }, data, select: { id: true } }),
      ]);
    }
    return this.findOne(id);
  }

  /**
   * Resolved tickets with no reply for AUTO_CLOSE_AFTER_DAYS become CLOSED.
   * Returns how many were closed.
   */
  async closeStale(now: Date = new Date()): Promise<number> {
    const stale = await this.prisma.ticket.findMany({
      where: {
        status: TicketStatus.RESOLVED,
        resolvedAt: { lt: new Date(now.getTime() - AUTO_CLOSE_AFTER_DAYS * DAY) },
      },
      select: { id: true },
      take: 1_000,
    });
    if (stale.length === 0) return 0;
    const ids = stale.map((ticket) => ticket.id);

    const [, closed] = await this.prisma.$transaction([
      this.prisma.ticketMessage.createMany({
        data: ids.map((ticketId) => ({
          ticketId,
          senderId: null,
          kind: TicketMessageKind.EVENT,
          message: `Closed automatically after ${AUTO_CLOSE_AFTER_DAYS} days without a reply`,
          createdAt: now,
        })),
      }),
      this.prisma.ticket.updateMany({
        where: { id: { in: ids }, status: TicketStatus.RESOLVED },
        data: { status: TicketStatus.CLOSED, awaitingStaff: false },
      }),
    ]);
    return closed.count;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private viewWhere(view: TicketView, actorId: number): Prisma.TicketWhereInput {
    switch (view) {
      case 'needs_reply':
        return { awaitingStaff: true };
      case 'mine':
        return { assigneeId: actorId, ...NOT_DONE };
      case 'unassigned':
        return { assigneeId: null, ...NOT_DONE };
      case 'waiting':
        return { status: TicketStatus.WAITING };
      case 'resolved':
        return { status: { in: [...DONE_STATUSES] } };
      case 'all':
        return {};
    }
  }

  private event(ticketId: number, senderId: number, event: EventInput, at: Date) {
    return this.prisma.ticketMessage.create({
      data: {
        ticketId,
        senderId,
        kind: TicketMessageKind.EVENT,
        isInternal: event.isInternal,
        message: event.message,
        createdAt: at,
      },
      select: { id: true },
    });
  }
}
