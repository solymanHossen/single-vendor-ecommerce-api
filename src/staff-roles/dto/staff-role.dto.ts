import { z } from 'zod';
import { ALL_PERMISSIONS, type Permission } from '../../access/permissions';

const PermissionListSchema = z
  .array(z.enum(ALL_PERMISSIONS as unknown as [Permission, ...Permission[]]))
  .max(ALL_PERMISSIONS.length)
  // Duplicates are harmless but normalised away.
  .transform((list) => [...new Set(list)]);

export const CreateStaffRoleSchema = z
  .object({
    name: z.string().trim().min(2, 'Give the role a name').max(60),
    description: z.string().trim().max(200).default(''),
    permissions: PermissionListSchema,
  })
  // Reject unrecognized fields instead of silently stripping them.
  .strict();

export const UpdateStaffRoleSchema = z
  .object({
    name: z.string().trim().min(2, 'Give the role a name').max(60).optional(),
    description: z.string().trim().max(200).optional(),
    permissions: PermissionListSchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type CreateStaffRoleDto = z.infer<typeof CreateStaffRoleSchema>;
export type UpdateStaffRoleDto = z.infer<typeof UpdateStaffRoleSchema>;
