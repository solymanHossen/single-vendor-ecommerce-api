import { BadRequestException, type ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { CurrentCart } from './cart-identity.decorator';
import type { AuthUser } from '../../auth/interfaces/auth.interfaces';
import type { CartIdentity } from '../interfaces/cart-identity.interface';

// `CurrentCart` is built with `createParamDecorator`, which wraps the factory
// we actually want to test in decorator plumbing. Nest exposes the raw
// factory for exactly this reason — see ROUTE_ARGS_METADATA usage in Nest's
// own createParamDecorator tests.
function getParamDecoratorFactory<T>(
  decorator: typeof CurrentCart,
): (data: unknown, ctx: ExecutionContext) => T {
  class TestDecorator {
    public test(@decorator() _identity: T): void {}
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

function buildContext(
  user: AuthUser | undefined,
  headers: Record<string, string> = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, headers }) as Request & { user?: AuthUser },
    }),
  } as unknown as ExecutionContext;
}

describe('CurrentCart decorator', () => {
  const factory = getParamDecoratorFactory<CartIdentity>(CurrentCart);

  it('returns a user identity when the request is authenticated', () => {
    const user: AuthUser = { id: 1, email: 'a@b.com', role: Role.USER, isActive: true };

    expect(factory(undefined, buildContext(user))).toEqual({ type: 'user', id: 1 });
  });

  it("returns a session identity from the 'x-session-id' header when unauthenticated", () => {
    const result = factory(undefined, buildContext(undefined, { 'x-session-id': 'abc-123' }));

    expect(result).toEqual({ type: 'session', id: 'abc-123' });
  });

  it('trims whitespace from the session id header', () => {
    const result = factory(undefined, buildContext(undefined, { 'x-session-id': '  abc-123  ' }));

    expect(result).toEqual({ type: 'session', id: 'abc-123' });
  });

  it('throws BadRequestException when unauthenticated and no session id header is present', () => {
    expect(() => factory(undefined, buildContext(undefined, {}))).toThrow(BadRequestException);
  });

  it('throws BadRequestException when the session id header is blank', () => {
    expect(() => factory(undefined, buildContext(undefined, { 'x-session-id': '   ' }))).toThrow(
      BadRequestException,
    );
  });
});
