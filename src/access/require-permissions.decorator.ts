import { SetMetadata } from '@nestjs/common';
import type { Permission } from './permissions';

export const PERMISSIONS_KEY = 'permissions';

/** The caller needs every listed permission (SUPER_ADMIN always passes). */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
