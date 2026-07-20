import { OrderStatus } from '@prisma/client';

/** Single source of truth for the enum's members, reused by every Zod schema that validates a status. */
export const ORDER_STATUS_VALUES = Object.values(OrderStatus) as [OrderStatus, ...OrderStatus[]];
