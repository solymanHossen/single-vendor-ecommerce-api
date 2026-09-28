import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';

/** Single source of truth for each enum's members, reused by every Zod schema that validates one. */
export const TICKET_STATUS_VALUES = Object.values(TicketStatus) as [
  TicketStatus,
  ...TicketStatus[],
];
export const TICKET_PRIORITY_VALUES = Object.values(TicketPriority) as [
  TicketPriority,
  ...TicketPriority[],
];
export const TICKET_CATEGORY_VALUES = Object.values(TicketCategory) as [
  TicketCategory,
  ...TicketCategory[],
];

/** Statuses where the conversation is finished (for now). */
export const DONE_STATUSES: readonly TicketStatus[] = [TicketStatus.RESOLVED, TicketStatus.CLOSED];

/** A new request's starting priority — staff can change it. */
export const CATEGORY_PRIORITY: Record<TicketCategory, TicketPriority> = {
  PAYMENT: TicketPriority.HIGH,
  DELIVERY: TicketPriority.MEDIUM,
  ORDER: TicketPriority.MEDIUM,
  RETURN: TicketPriority.MEDIUM,
  PRODUCT: TicketPriority.MEDIUM,
  ACCOUNT: TicketPriority.MEDIUM,
  OTHER: TicketPriority.LOW,
};

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  ORDER: 'Order',
  DELIVERY: 'Delivery',
  PAYMENT: 'Payment',
  RETURN: 'Return or exchange',
  PRODUCT: 'Product',
  ACCOUNT: 'Account',
  OTHER: 'Something else',
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING: 'Waiting on customer',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

/** Admin queue tabs. */
export const TICKET_VIEWS = [
  'needs_reply',
  'mine',
  'unassigned',
  'waiting',
  'resolved',
  'all',
] as const;
export type TicketView = (typeof TICKET_VIEWS)[number];

/** Resolved tickets close for good after this many quiet days. */
export const AUTO_CLOSE_AFTER_DAYS = 7;
export const TICKET_AUTO_CLOSE_LOCK_KEY = 'lock:ticket-auto-close';

export const MAX_TICKET_ATTACHMENTS = 4;
export const MAX_TICKET_MESSAGE_LENGTH = 5000;
/** Characters of the latest message shown in list rows. */
export const TICKET_PREVIEW_LENGTH = 140;
