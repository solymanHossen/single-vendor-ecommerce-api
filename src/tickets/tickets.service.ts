import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { TicketQueryDto } from './dto/query-ticket.dto';
import {
  PaginatedTicketsEntity,
  PaginationMetaEntity,
  TicketEntity,
  TicketMessageEntity,
  TicketSenderSummaryEntity,
} from './entities/ticket.entity';

const TICKET_SELECT = {
  id: true,
  userId: true,
  orderId: true,
  subject: true,
  status: true,
  priority: true,
  messages: {
    select: {
      id: true,
      message: true,
      createdAt: true,
      sender: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TicketSelect;

type TicketRow = Prisma.TicketGetPayload<{ select: typeof TICKET_SELECT }>;

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, dto: CreateTicketDto): Promise<TicketEntity> {
    if (dto.orderId !== undefined) {
      await this.assertOrderOwnership(userId, dto.orderId);
    }

    const ticket = await this.prisma.ticket.create({
      data: {
        userId,
        orderId: dto.orderId,
        subject: dto.subject,
        priority: dto.priority,
        messages: { create: [{ senderId: userId, message: dto.message }] },
      },
      select: TICKET_SELECT,
    });

    return this.toEntity(ticket);
  }

  async findAll(requester: AuthUser, query: TicketQueryDto): Promise<PaginatedTicketsEntity> {
    const isStaff = this.isStaff(requester);
    const where: Prisma.TicketWhereInput = {};

    if (!isStaff) {
      where.userId = requester.id;
    } else if (query.userId !== undefined) {
      where.userId = query.userId;
    }

    if (query.status !== undefined) {
      where.status = query.status;
    }
    if (query.priority !== undefined) {
      where.priority = query.priority;
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        select: TICKET_SELECT,
        orderBy: { createdAt: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return new PaginatedTicketsEntity({
      items: rows.map((row) => this.toEntity(row)),
      meta: new PaginationMetaEntity({
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      }),
    });
  }

  async findOne(requester: AuthUser, id: number): Promise<TicketEntity> {
    const isStaff = this.isStaff(requester);

    const ticket = await this.prisma.ticket.findFirst({
      where: { id, ...(isStaff ? {} : { userId: requester.id }) },
      select: TICKET_SELECT,
    });

    if (!ticket) {
      throw new NotFoundException('Ticket does not exist.');
    }

    return this.toEntity(ticket);
  }

  async addMessage(
    requester: AuthUser,
    ticketId: number,
    dto: CreateTicketMessageDto,
  ): Promise<TicketEntity> {
    const isStaff = this.isStaff(requester);

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, ...(isStaff ? {} : { userId: requester.id }) },
      select: { id: true },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket does not exist.');
    }

    await this.prisma.ticketMessage.create({
      data: { ticketId, senderId: requester.id, message: dto.message },
      select: { id: true },
    });

    const updated = await this.prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      select: TICKET_SELECT,
    });

    return this.toEntity(updated);
  }

  async updateStatus(id: number, dto: UpdateTicketStatusDto): Promise<TicketEntity> {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: dto.status },
      select: TICKET_SELECT,
    });

    return this.toEntity(ticket);
  }

  private isStaff(requester: AuthUser): boolean {
    return requester.role === Role.ADMIN || requester.role === Role.SUPER_ADMIN;
  }

  private async assertOrderOwnership(userId: number, orderId: number): Promise<void> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true },
    });

    if (!order) {
      throw new NotFoundException('Order does not exist for the current user.');
    }
  }

  private toEntity(ticket: TicketRow): TicketEntity {
    return new TicketEntity({
      id: ticket.id,
      userId: ticket.userId,
      orderId: ticket.orderId,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      messages: ticket.messages.map(
        (message) =>
          new TicketMessageEntity({
            id: message.id,
            sender: new TicketSenderSummaryEntity({
              id: message.sender.id,
              name: message.sender.name,
            }),
            message: message.message,
            createdAt: message.createdAt,
          }),
      ),
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    });
  }
}
