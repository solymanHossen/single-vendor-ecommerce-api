import { BadRequestException, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../../auth/interfaces/auth.interfaces';
import { SESSION_ID_HEADER } from '../carts.constants';
import type { CartIdentity } from '../interfaces/cart-identity.interface';

export const CurrentCart = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): CartIdentity => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();

    if (request.user) {
      return { type: 'user', id: request.user.id };
    }

    const header = request.headers[SESSION_ID_HEADER];
    const sessionId = (Array.isArray(header) ? header[0] : header)?.trim();

    if (!sessionId) {
      throw new BadRequestException(
        `Guest cart access requires a non-empty '${SESSION_ID_HEADER}' header.`,
      );
    }

    return { type: 'session', id: sessionId };
  },
);
