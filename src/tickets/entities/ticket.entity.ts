import { ApiProperty } from '@nestjs/swagger';
import type { TicketPriority, TicketStatus } from '@prisma/client';

export class TicketSenderSummaryEntity {
  @ApiProperty({ example: 7 })
  id: number;

  @ApiProperty({ nullable: true, example: 'Jane Doe' })
  name: string | null;

  constructor(partial: TicketSenderSummaryEntity) {
    this.id = partial.id;
    this.name = partial.name;
  }
}

interface TicketMessageEntityInput {
  id: number;
  sender: TicketSenderSummaryEntity;
  message: string;
  createdAt: Date;
}

export class TicketMessageEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ type: () => TicketSenderSummaryEntity })
  sender: TicketSenderSummaryEntity;

  @ApiProperty({ example: 'Could you provide an update on my order?' })
  message: string;

  @ApiProperty()
  createdAt: Date;

  constructor(partial: TicketMessageEntityInput) {
    this.id = partial.id;
    this.sender = partial.sender;
    this.message = partial.message;
    this.createdAt = partial.createdAt;
  }
}

interface TicketEntityInput {
  id: number;
  userId: number;
  orderId: number | null;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  messages: TicketMessageEntity[];
  createdAt: Date;
  updatedAt: Date;
}

export class TicketEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 7 })
  userId: number;

  @ApiProperty({ nullable: true, example: 301 })
  orderId: number | null;

  @ApiProperty({ example: 'Order not received' })
  subject: string;

  @ApiProperty({ enum: ['OPEN', 'IN_PROGRESS', 'CLOSED'] })
  status: TicketStatus;

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH'] })
  priority: TicketPriority;

  @ApiProperty({ type: () => TicketMessageEntity, isArray: true })
  messages: TicketMessageEntity[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: TicketEntityInput) {
    this.id = partial.id;
    this.userId = partial.userId;
    this.orderId = partial.orderId;
    this.subject = partial.subject;
    this.status = partial.status;
    this.priority = partial.priority;
    this.messages = partial.messages;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}

interface PaginationMetaEntityInput {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class PaginationMetaEntity {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  constructor(partial: PaginationMetaEntityInput) {
    this.page = partial.page;
    this.limit = partial.limit;
    this.total = partial.total;
    this.totalPages = partial.totalPages;
  }
}

interface PaginatedTicketsEntityInput {
  items: TicketEntity[];
  meta: PaginationMetaEntity;
}

export class PaginatedTicketsEntity {
  @ApiProperty({ type: () => TicketEntity, isArray: true })
  items: TicketEntity[];

  @ApiProperty({ type: () => PaginationMetaEntity })
  meta: PaginationMetaEntity;

  constructor(partial: PaginatedTicketsEntityInput) {
    this.items = partial.items;
    this.meta = partial.meta;
  }
}
