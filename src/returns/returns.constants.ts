import { ReturnStatus } from '@prisma/client';

/** Single source of truth for the enum's members, reused by every Zod schema that validates a status. */
export const RETURN_STATUS_VALUES = Object.values(ReturnStatus) as [
  ReturnStatus,
  ...ReturnStatus[],
];
