import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AuthUser } from '../interfaces/auth.interfaces';

/**
 * Attempts JWT authentication but never rejects the request: a missing,
 * expired, or invalid token simply leaves `request.user` unset instead of
 * throwing, so the same route serves guests and authenticated users alike.
 *
 * Must be paired with `@Public()` on the route — the global JwtAuthGuard
 * (registered as APP_GUARD) would otherwise reject an unauthenticated
 * request before this guard ever runs.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthUser>(
    _err: unknown,
    user: TUser | false,
    _info: unknown,
    _context: ExecutionContext,
  ): TUser | undefined {
    return user ? user : undefined;
  }
}
