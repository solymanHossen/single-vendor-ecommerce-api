import { Role } from '@prisma/client';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import type { AuthUser } from '../interfaces/auth.interfaces';

describe('OptionalJwtAuthGuard', () => {
  describe('handleRequest', () => {
    let guard: OptionalJwtAuthGuard;

    beforeEach(() => {
      guard = new OptionalJwtAuthGuard();
    });

    it('returns the user when authentication succeeded', () => {
      const user: AuthUser = { id: 1, email: 'a@b.com', role: Role.USER, isActive: true };

      expect(guard.handleRequest(null, user, null, undefined as never)).toBe(user);
    });

    it('returns undefined instead of throwing when there is no token', () => {
      expect(guard.handleRequest(null, false, null, undefined as never)).toBeUndefined();
    });

    it('returns undefined instead of throwing when the strategy errored', () => {
      const strategyError = new Error('token expired');

      expect(guard.handleRequest(strategyError, false, null, undefined as never)).toBeUndefined();
    });
  });
});
