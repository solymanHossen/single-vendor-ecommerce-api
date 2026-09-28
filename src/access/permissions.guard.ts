import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import type { Permission } from './permissions';
import { PERMISSIONS_KEY } from './require-permissions.decorator';

/**
 * Runs after JwtAuthGuard. Permissions come from JwtStrategy, which reads
 * the user (and their staff role) on every request — so revoking access
 * takes effect on the very next call, not when a token expires.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest<Request & { user?: AuthUser }>().user;
    const missing = required.filter((permission) => !user?.permissions.includes(permission));
    if (!user || missing.length > 0) {
      throw new ForbiddenException("You don't have permission to do this");
    }
    return true;
  }
}

export function hasPermission(user: AuthUser | undefined, permission: Permission): boolean {
  return !!user?.permissions.includes(permission);
}
