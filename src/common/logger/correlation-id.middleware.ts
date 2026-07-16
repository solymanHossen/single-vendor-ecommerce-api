import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { CorrelationIdStore } from './correlation-id.store';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Applied imperatively in main.ts (via `app.use(...)`) rather than through
 * a module's `configure()` hook, so its position relative to the other raw
 * Express middleware (helmet, morgan, ...) registered there is explicit and
 * unambiguous — it must run before Morgan so the request's log line, and
 * everything downstream of it, can read the correlation ID.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(private readonly correlationIdStore: CorrelationIdStore) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = this.extractIncomingId(req) ?? randomUUID();

    res.setHeader('X-Correlation-ID', correlationId);

    this.correlationIdStore.run({ correlationId }, () => {
      next();
    });
  }

  private extractIncomingId(req: Request): string | undefined {
    const header = req.headers[CORRELATION_ID_HEADER];
    const raw = Array.isArray(header) ? header[0] : header;
    const trimmed = raw?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
  }
}
