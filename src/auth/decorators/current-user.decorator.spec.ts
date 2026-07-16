import type { ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from './current-user.decorator';
import type { AuthUser } from '../interfaces/auth.interfaces';

// `CurrentUser` is built with `createParamDecorator`, which wraps the factory
// we actually want to test in decorator plumbing. Nest exposes the raw
// factory for exactly this reason — see ROUTE_ARGS_METADATA usage in Nest's
// own createParamDecorator tests.
function getParamDecoratorFactory<T>(
  decorator: typeof CurrentUser,
): (data: unknown, ctx: ExecutionContext) => T {
  class TestDecorator {
    public test(@decorator() _user: T): void {}
  }

  const args = Reflect.getMetadata('__routeArguments__', TestDecorator, 'test') as
    | Record<string, { factory: (data: unknown, ctx: ExecutionContext) => T }>
    | undefined;

  const key = args ? Object.keys(args)[0] : undefined;
  const entry = args && key ? args[key] : undefined;
  if (!entry) {
    throw new Error('Expected createParamDecorator metadata to be set');
  }
  return entry.factory;
}

function buildContext(user: AuthUser | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }) as Request & { user?: AuthUser },
    }),
  } as unknown as ExecutionContext;
}

describe('CurrentUser decorator', () => {
  it('extracts `request.user` set by JwtAuthGuard/JwtStrategy', () => {
    const user: AuthUser = { id: 1, email: 'a@b.com', role: Role.USER, isActive: true };
    const factory = getParamDecoratorFactory<AuthUser>(CurrentUser);

    expect(factory(undefined, buildContext(user))).toBe(user);
  });

  it('returns undefined when no user is attached to the request', () => {
    const factory = getParamDecoratorFactory<AuthUser | undefined>(CurrentUser);

    expect(factory(undefined, buildContext(undefined))).toBeUndefined();
  });
});
