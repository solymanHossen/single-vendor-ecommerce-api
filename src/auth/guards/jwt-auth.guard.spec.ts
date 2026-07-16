import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

function buildContext(): ExecutionContext {
  return {
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  describe('canActivate', () => {
    it('allows the request through without invoking passport when the route is @Public', () => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(true),
      } as unknown as Reflector;
      const guard = new JwtAuthGuard(reflector);
      const superCanActivate = jest.spyOn(
        Object.getPrototypeOf(JwtAuthGuard.prototype),
        'canActivate',
      );

      const result = guard.canActivate(buildContext());

      expect(result).toBe(true);
      expect(superCanActivate).not.toHaveBeenCalled();
      superCanActivate.mockRestore();
    });

    it('delegates to the passport JWT strategy when the route is not public', () => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(false),
      } as unknown as Reflector;
      const guard = new JwtAuthGuard(reflector);
      const superCanActivate = jest
        .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      const result = guard.canActivate(buildContext());

      expect(result).toBe(true);
      expect(superCanActivate).toHaveBeenCalledTimes(1);
      superCanActivate.mockRestore();
    });
  });

  describe('handleRequest', () => {
    let guard: JwtAuthGuard;

    beforeEach(() => {
      const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
      guard = new JwtAuthGuard(reflector);
    });

    it('returns the user when authentication succeeded', () => {
      const user = { id: 1, email: 'a@b.com' };

      expect(guard.handleRequest(null, user)).toBe(user);
    });

    it('rethrows the strategy error when one is present', () => {
      const strategyError = new Error('token expired');

      expect(() => guard.handleRequest(strategyError, undefined)).toThrow(strategyError);
    });

    it('throws a generic UnauthorizedException when there is no user and no error', () => {
      expect(() => guard.handleRequest(null, undefined)).toThrow(UnauthorizedException);
    });
  });
});
