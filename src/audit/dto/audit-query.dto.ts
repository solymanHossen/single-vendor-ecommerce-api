import { z } from 'zod';
import { AUDIT_AREAS } from '../audit.constants';

export const AuditQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(30),
    area: z.enum(AUDIT_AREAS).optional(),
    actorId: z.coerce.number().int().positive().optional(),
    targetType: z.enum(['user', 'role', 'settings']).optional(),
    targetId: z.string().trim().max(50).optional(),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export type AuditQueryDto = z.infer<typeof AuditQuerySchema>;
