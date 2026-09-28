import { z } from 'zod';

export const AdminUserQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(150).optional(),
    // "staff" / "all" are narrowed to customers for anyone but a SUPER_ADMIN.
    type: z.enum(['all', 'customers', 'staff']).default('all'),
    status: z.enum(['all', 'active', 'inactive', 'locked']).default('all'),
    sortBy: z.enum(['createdAt', 'lastLoginAt', 'name']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export const UpdateUserStatusSchema = z.object({ isActive: z.boolean() }).strict();

export const UpdateUserAccessSchema = z
  .object({
    // SUPER_ADMIN can't be granted here: owner accounts are set up out of band.
    role: z.enum(['USER', 'ADMIN']),
    staffRoleId: z.number().int().positive().nullable().default(null),
  })
  .strict()
  .refine((data) => data.role === 'USER' || data.staffRoleId !== null, {
    message: 'Choose a staff role for this admin',
    path: ['staffRoleId'],
  });

export type AdminUserQueryDto = z.infer<typeof AdminUserQuerySchema>;
export type UpdateUserStatusDto = z.infer<typeof UpdateUserStatusSchema>;
export type UpdateUserAccessDto = z.infer<typeof UpdateUserAccessSchema>;
