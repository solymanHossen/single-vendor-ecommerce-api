import { ApiProperty } from '@nestjs/swagger';
import type {
  OrderStatus,
  Prisma,
  TicketCategory,
  TicketMessageKind,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';
import {
  TICKET_CATEGORY_VALUES,
  TICKET_PRIORITY_VALUES,
  TICKET_STATUS_VALUES,
  type TicketView,
} from '../tickets.constants';

export class TicketPersonEntity {
  @ApiProperty({ example: 7 })
  id: number;

  @ApiProperty({ nullable: true, example: 'Nusrat Jahan' })
  name: string | null;

  @ApiProperty({ nullable: true, example: 'nusrat@example.com', description: 'Staff views only' })
  email: string | null;

  @ApiProperty({ nullable: true })
  avatarUrl: string | null;

  constructor(partial: TicketPersonEntity) {
    this.id = partial.id;
    this.name = partial.name;
    this.email = partial.email;
    this.avatarUrl = partial.avatarUrl;
  }
}

export class TicketMessageEntity {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ enum: ['REPLY', 'NOTE', 'EVENT'] })
  kind: TicketMessageKind;

  @ApiProperty({ description: 'Staff-only (notes, internal events)' })
  isInternal: boolean;

  @ApiProperty({ description: 'Written by staff rather than the customer' })
  fromStaff: boolean;

  @ApiProperty({ type: () => TicketPersonEntity, nullable: true, description: 'null = system' })
  sender: TicketPersonEntity | null;

  @ApiProperty()
  message: string;

  @ApiProperty({ type: [String] })
  attachments: string[];

  @ApiProperty()
  createdAt: Date;

  constructor(partial: TicketMessageEntity) {
    this.id = partial.id;
    this.kind = partial.kind;
    this.isInternal = partial.isInternal;
    this.fromStaff = partial.fromStaff;
    this.sender = partial.sender;
    this.message = partial.message;
    this.attachments = partial.attachments;
    this.createdAt = partial.createdAt;
  }
}

export class TicketPreviewEntity {
  @ApiProperty()
  text: string;

  @ApiProperty()
  fromStaff: boolean;

  @ApiProperty()
  at: Date;

  constructor(partial: TicketPreviewEntity) {
    this.text = partial.text;
    this.fromStaff = partial.fromStaff;
    this.at = partial.at;
  }
}

export interface TicketListItemInput {
  id: number;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  orderId: number | null;
  awaitingStaff: boolean;
  unread: boolean;
  replyCount: number;
  preview: TicketPreviewEntity | null;
  lastMessageAt: Date;
  createdAt: Date;
  customer: TicketPersonEntity | null;
  assignee: TicketPersonEntity | null;
}

export class TicketListItemEntity {
  @ApiProperty({ example: 42 })
  id: number;

  @ApiProperty()
  subject: string;

  @ApiProperty({ enum: TICKET_CATEGORY_VALUES })
  category: TicketCategory;

  @ApiProperty({ enum: TICKET_STATUS_VALUES })
  status: TicketStatus;

  @ApiProperty({ enum: TICKET_PRIORITY_VALUES })
  priority: TicketPriority;

  @ApiProperty({ nullable: true })
  orderId: number | null;

  @ApiProperty({ description: 'The customer spoke last — staff should reply' })
  awaitingStaff: boolean;

  @ApiProperty({ description: 'Customer view: a staff reply the customer has not opened' })
  unread: boolean;

  @ApiProperty({ description: 'Public messages in the thread' })
  replyCount: number;

  @ApiProperty({ type: () => TicketPreviewEntity, nullable: true })
  preview: TicketPreviewEntity | null;

  @ApiProperty()
  lastMessageAt: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: () => TicketPersonEntity, nullable: true, description: 'Staff views only' })
  customer: TicketPersonEntity | null;

  @ApiProperty({ type: () => TicketPersonEntity, nullable: true })
  assignee: TicketPersonEntity | null;

  constructor(partial: TicketListItemInput) {
    this.id = partial.id;
    this.subject = partial.subject;
    this.category = partial.category;
    this.status = partial.status;
    this.priority = partial.priority;
    this.orderId = partial.orderId;
    this.awaitingStaff = partial.awaitingStaff;
    this.unread = partial.unread;
    this.replyCount = partial.replyCount;
    this.preview = partial.preview;
    this.lastMessageAt = partial.lastMessageAt;
    this.createdAt = partial.createdAt;
    this.customer = partial.customer;
    this.assignee = partial.assignee;
  }
}

export class TicketOrderEntity {
  @ApiProperty({ example: 331 })
  id: number;

  @ApiProperty()
  status: OrderStatus;

  @ApiProperty({ type: String })
  totalAmount: Prisma.Decimal;

  @ApiProperty()
  itemCount: number;

  @ApiProperty()
  createdAt: Date;

  constructor(partial: TicketOrderEntity) {
    this.id = partial.id;
    this.status = partial.status;
    this.totalAmount = partial.totalAmount;
    this.itemCount = partial.itemCount;
    this.createdAt = partial.createdAt;
  }
}

export class TicketCustomerStatsEntity {
  @ApiProperty()
  orderCount: number;

  @ApiProperty()
  ticketCount: number;

  @ApiProperty()
  memberSince: Date;

  constructor(partial: TicketCustomerStatsEntity) {
    this.orderCount = partial.orderCount;
    this.ticketCount = partial.ticketCount;
    this.memberSince = partial.memberSince;
  }
}

export interface TicketDetailInput extends TicketListItemInput {
  messages: TicketMessageEntity[];
  order: TicketOrderEntity | null;
  satisfied: boolean | null;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  canReply: boolean;
  customerStats: TicketCustomerStatsEntity | null;
}

export class TicketDetailEntity extends TicketListItemEntity {
  @ApiProperty({ type: () => TicketMessageEntity, isArray: true })
  messages: TicketMessageEntity[];

  @ApiProperty({ type: () => TicketOrderEntity, nullable: true })
  order: TicketOrderEntity | null;

  @ApiProperty({ nullable: true, description: 'Customer feedback once resolved' })
  satisfied: boolean | null;

  @ApiProperty({ nullable: true })
  firstResponseAt: Date | null;

  @ApiProperty({ nullable: true })
  resolvedAt: Date | null;

  @ApiProperty({ description: 'Whether the viewer can add a reply' })
  canReply: boolean;

  @ApiProperty({ type: () => TicketCustomerStatsEntity, nullable: true, description: 'Staff only' })
  customerStats: TicketCustomerStatsEntity | null;

  constructor(partial: TicketDetailInput) {
    super(partial);
    this.messages = partial.messages;
    this.order = partial.order;
    this.satisfied = partial.satisfied;
    this.firstResponseAt = partial.firstResponseAt;
    this.resolvedAt = partial.resolvedAt;
    this.canReply = partial.canReply;
    this.customerStats = partial.customerStats;
  }
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

  constructor(partial: PaginationMetaEntity) {
    this.page = partial.page;
    this.limit = partial.limit;
    this.total = partial.total;
    this.totalPages = partial.totalPages;
  }
}

export class PaginatedTicketsEntity {
  @ApiProperty({ type: () => TicketListItemEntity, isArray: true })
  items: TicketListItemEntity[];

  @ApiProperty({ type: () => PaginationMetaEntity })
  meta: PaginationMetaEntity;

  constructor(partial: PaginatedTicketsEntity) {
    this.items = partial.items;
    this.meta = partial.meta;
  }
}

export class TicketSummaryEntity {
  @ApiProperty({
    example: { needs_reply: 4, mine: 2, unassigned: 3, waiting: 6, resolved: 30, all: 48 },
  })
  views: Record<TicketView, number>;

  @ApiProperty({ example: 18, description: 'Tickets not resolved or closed' })
  openCount: number;

  @ApiProperty({ nullable: true, example: 95, description: 'Average first response, last 30 days' })
  avgFirstResponseMinutes: number | null;

  @ApiProperty({ nullable: true, example: 0.86, description: 'Share rated helpful, last 90 days' })
  satisfactionRate: number | null;

  @ApiProperty({ example: 21 })
  ratedCount: number;

  constructor(partial: TicketSummaryEntity) {
    this.views = partial.views;
    this.openCount = partial.openCount;
    this.avgFirstResponseMinutes = partial.avgFirstResponseMinutes;
    this.satisfactionRate = partial.satisfactionRate;
    this.ratedCount = partial.ratedCount;
  }
}
