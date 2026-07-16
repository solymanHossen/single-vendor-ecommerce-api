import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { RolesGuard } from './roles.guard';
import type { AuthUser } from '../interfaces/auth.interfaces';

function buildContext(
  user: AuthUser | undefined,
  requiredRoles: Role[] | undefined,
): {
  context: ExecutionContext;
  reflector: Reflector;
} {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
  } as unknown as Reflector;

  const context = {
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }) as Request & { user?: AuthUser },
    }),
  } as unknown as ExecutionContext;

  return { context, reflector };
}

describe('RolesGuard', () => {
  it('allows the request through when the route declares no required roles', () => {
    const { context, reflector } = buildContext(undefined, undefined);
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows the request through when the required-roles array is empty', () => {
    const { context, reflector } = buildContext(undefined, []);
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a user whose role is in the required set', () => {
    const user: AuthUser = { id: 1, email: 'a@b.com', role: Role.ADMIN, isActive: true };
    const { context, reflector } = buildContext(user, [Role.ADMIN, Role.SUPER_ADMIN]);
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a user whose role is not in the required set', () => {
    const user: AuthUser = { id: 1, email: 'a@b.com', role: Role.USER, isActive: true };
    const { context, reflector } = buildContext(user, [Role.ADMIN]);
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects when roles are required but no user is attached to the request', () => {
    const { context, reflector } = buildContext(undefined, [Role.ADMIN]);
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
