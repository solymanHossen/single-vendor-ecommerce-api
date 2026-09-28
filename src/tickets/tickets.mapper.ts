import { type Prisma, TicketMessageKind, type TicketStatus } from '@prisma/client';
import { DONE_STATUSES, TICKET_PREVIEW_LENGTH } from './tickets.constants';
import {
  type TicketCustomerStatsEntity,
  TicketDetailEntity,
  TicketListItemEntity,
  TicketMessageEntity,
  TicketOrderEntity,
  TicketPersonEntity,
  TicketPreviewEntity,
} from './entities/ticket.entity';

export type Audience = 'customer' | 'staff';

const PERSON_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

const PUBLIC_REPLY = { kind: TicketMessageKind.REPLY } satisfies Prisma.TicketMessageWhereInput;

export const TICKET_LIST_SELECT = {
  id: true,
  userId: true,
  subject: true,
  category: true,
  status: true,
  priority: true,
  orderId: true,
  awaitingStaff: true,
  lastMessageAt: true,
  lastStaffReplyAt: true,
  customerReadAt: true,
  createdAt: true,
  user: { select: PERSON_SELECT },
  assignee: { select: PERSON_SELECT },
  // Latest public message, for the row preview.
  messages: {
    where: PUBLIC_REPLY,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { message: true, senderId: true, createdAt: true },
  },
  _count: { select: { messages: { where: PUBLIC_REPLY } } },
} satisfies Prisma.TicketSelect;

export type TicketListRow = Prisma.TicketGetPayload<{ select: typeof TICKET_LIST_SELECT }>;

export const TICKET_DETAIL_SELECT = {
  ...TICKET_LIST_SELECT,
  satisfied: true,
  firstResponseAt: true,
  resolvedAt: true,
  user: { select: { ...PERSON_SELECT, createdAt: true } },
  order: {
    select: {
      id: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  },
} satisfies Prisma.TicketSelect;

export type TicketDetailRow = Prisma.TicketGetPayload<{ select: typeof TICKET_DETAIL_SELECT }>;

const THREAD_SELECT = {
  id: true,
  kind: true,
  isInternal: true,
  message: true,
  attachments: true,
  createdAt: true,
  senderId: true,
  sender: { select: PERSON_SELECT },
} satisfies Prisma.TicketMessageSelect;

/** The whole thread, oldest first; internal entries only for staff. */
export function threadQuery(ticketId: number, audience: Audience) {
  return {
    where: { ticketId, ...(audience === 'customer' ? { isInternal: false } : {}) },
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    select: THREAD_SELECT,
  };
}

type ThreadRow = Prisma.TicketMessageGetPayload<{ select: typeof THREAD_SELECT }>;

type Person = { id: number; name: string | null; email: string; avatarUrl: string | null };

/** Customers never see staff email addresses. */
function person(user: Person, audience: Audience): TicketPersonEntity {
  return new TicketPersonEntity({
    id: user.id,
    name: user.name,
    email: audience === 'staff' ? user.email : null,
    avatarUrl: user.avatarUrl,
  });
}

function preview(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > TICKET_PREVIEW_LENGTH
    ? `${flat.slice(0, TICKET_PREVIEW_LENGTH - 1)}…`
    : flat;
}

export function hasUnreadReply(row: {
  lastStaffReplyAt: Date | null;
  customerReadAt: Date | null;
}): boolean {
  if (!row.lastStaffReplyAt) return false;
  return !row.customerReadAt || row.lastStaffReplyAt > row.customerReadAt;
}

function listFields(row: TicketListRow, audience: Audience) {
  const latest = row.messages[0];
  return {
    id: row.id,
    subject: row.subject,
    category: row.category,
    status: row.status,
    priority: row.priority,
    orderId: row.orderId,
    awaitingStaff: row.awaitingStaff,
    unread: audience === 'customer' && hasUnreadReply(row),
    replyCount: row._count.messages,
    preview: latest
      ? new TicketPreviewEntity({
          text: preview(latest.message),
          fromStaff: latest.senderId !== row.userId,
          at: latest.createdAt,
        })
      : null,
    lastMessageAt: row.lastMessageAt,
    createdAt: row.createdAt,
    customer: audience === 'staff' ? person(row.user, audience) : null,
    assignee: row.assignee ? person(row.assignee, audience) : null,
  };
}

export function toListItem(row: TicketListRow, audience: Audience): TicketListItemEntity {
  return new TicketListItemEntity(listFields(row, audience));
}

export function toDetail(
  row: TicketDetailRow,
  thread: ThreadRow[],
  audience: Audience,
  customerStats: TicketCustomerStatsEntity | null = null,
): TicketDetailEntity {
  return new TicketDetailEntity({
    ...listFields(row, audience),
    messages: thread.map(
      (message) =>
        new TicketMessageEntity({
          id: message.id,
          kind: message.kind,
          isInternal: message.isInternal,
          // System events (no sender) read as coming from the store.
          fromStaff: message.senderId !== row.userId,
          sender: message.sender ? person(message.sender, audience) : null,
          message: message.message,
          attachments: message.attachments,
          createdAt: message.createdAt,
        }),
    ),
    order: row.order
      ? new TicketOrderEntity({
          id: row.order.id,
          status: row.order.status,
          totalAmount: row.order.totalAmount,
          itemCount: row.order._count.items,
          createdAt: row.order.createdAt,
        })
      : null,
    satisfied: row.satisfied,
    firstResponseAt: row.firstResponseAt,
    resolvedAt: row.resolvedAt,
    // Customers can't write into a closed thread; staff always can.
    canReply: audience === 'staff' || row.status !== 'CLOSED',
    customerStats,
  });
}

export function isDone(status: TicketStatus): boolean {
  return DONE_STATUSES.includes(status);
}
