import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { type Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import {
  ALL_PERMISSIONS,
  DEFAULT_STAFF_ROLES,
  PERMISSION_GROUPS,
  effectivePermissions,
  isPermission,
} from './permissions';
import { PermissionsGuard, hasPermission } from './permissions.guard';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

describe('permissions catalogue', () => {
  it('has unique keys', () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
  });

  it('never offers access or role management as a grantable permission', () => {
    // Otherwise a staff member could edit their own role into full access.
    expect(ALL_PERMISSIONS.some((key) => /^(staff|roles|users|audit)\./.test(key))).toBe(false);
  });

  it('describes every permission for the admin UI', () => {
    for (const group of PERMISSION_GROUPS) {
      for (const permission of group.permissions) {
        expect(permission.label.length).toBeGreaterThan(0);
        expect(permission.description.length).toBeGreaterThan(0);
      }
    }
  });

  it('builds the default roles only from real permissions', () => {
    for (const role of DEFAULT_STAFF_ROLES) {
      expect(role.permissions.every(isPermission)).toBe(true);
    }
  });
});

describe('effectivePermissions()', () => {
  it('gives a super admin everything, regardless of any staff role', () => {
    expect(effectivePermissions(Role.SUPER_ADMIN, [])).toEqual([...ALL_PERMISSIONS]);
  });

  it("gives an admin exactly their role's valid permissions", () => {
    expect(effectivePermissions(Role.ADMIN, ['orders.view', 'retired.key'])).toEqual([
      'orders.view',
    ]);
    expect(effectivePermissions(Role.ADMIN, null)).toEqual([]);
  });

  it('gives customers nothing, even if data says otherwise', () => {
    expect(effectivePermissions(Role.USER, ['orders.view'])).toEqual([]);
  });
});

describe('PermissionsGuard', () => {
  const user = (permissions: AuthUser['permissions']): AuthUser => ({
    id: 1,
    email: 'a@b.com',
    role: Role.ADMIN,
    isActive: true,
    permissions,
  });
  const context = (requestUser?: AuthUser) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user: requestUser }) }),
    }) as unknown as ExecutionContext;

  const guardRequiring = (required: string[] | undefined) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(required),
    } as unknown as Reflector;
    return new PermissionsGuard(reflector);
  };

  it('passes routes that declare nothing', () => {
    expect(guardRequiring(undefined).canActivate(context())).toBe(true);
  });

  it('requires every listed permission', () => {
    const guard = guardRequiring(['orders.view', 'orders.manage']);
    expect(guard.canActivate(context(user(['orders.view', 'orders.manage'])))).toBe(true);
    expect(() => guard.canActivate(context(user(['orders.view'])))).toThrow(ForbiddenException);
  });

  it('refuses when there is no user', () => {
    expect(() => guardRequiring(['orders.view']).canActivate(context())).toThrow(
      ForbiddenException,
    );
  });

  it('hasPermission() is false for a missing user', () => {
    expect(hasPermission(undefined, 'orders.view')).toBe(false);
    expect(hasPermission(user(['orders.view']), 'orders.view')).toBe(true);
  });
});
