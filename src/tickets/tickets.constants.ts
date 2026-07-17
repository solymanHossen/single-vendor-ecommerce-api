import { TicketPriority, TicketStatus } from '@prisma/client';

/** Single source of truth for each enum's members, reused by every Zod schema that validates one. */
export const TICKET_STATUS_VALUES = Object.values(TicketStatus) as [
  TicketStatus,
  ...TicketStatus[],
];
export const TICKET_PRIORITY_VALUES = Object.values(TicketPriority) as [
  TicketPriority,
  ...TicketPriority[],
];
