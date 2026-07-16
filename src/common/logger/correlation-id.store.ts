import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface CorrelationContext {
  correlationId: string;
}

/**
 * Thin wrapper around Node's AsyncLocalStorage. Kept as its own injectable
 * (rather than exposing the AsyncLocalStorage instance directly) so both the
 * middleware that seeds the context and every consumer that reads from it
 * share exactly one instance via the DI container, and so the storage
 * mechanism can be swapped later without touching call sites.
 */
@Injectable()
export class CorrelationIdStore {
  private readonly asyncLocalStorage = new AsyncLocalStorage<CorrelationContext>();

  /**
   * Runs `callback` with `context` bound to the active async execution chain.
   * Anything invoked synchronously or asynchronously from within `callback`
   * — including event listeners registered during its execution, such as
   * Morgan's `res.on('finish', ...)` — can read the same context back out.
   */
  run(context: CorrelationContext, callback: () => void): void {
    this.asyncLocalStorage.run(context, callback);
  }

  getCorrelationId(): string | undefined {
    return this.asyncLocalStorage.getStore()?.correlationId;
  }
}
