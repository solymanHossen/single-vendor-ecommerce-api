import { EventEmitter } from 'node:events';
import { CorrelationIdStore } from './correlation-id.store';

describe('CorrelationIdStore', () => {
  let store: CorrelationIdStore;

  beforeEach(() => {
    store = new CorrelationIdStore();
  });

  it('returns undefined when read outside of any run() context', () => {
    expect(store.getCorrelationId()).toBeUndefined();
  });

  it('exposes the bound correlationId to synchronous code inside run()', () => {
    let observed: string | undefined;

    store.run({ correlationId: 'sync-id' }, () => {
      observed = store.getCorrelationId();
    });

    expect(observed).toBe('sync-id');
  });

  it('exposes the bound correlationId to asynchronous continuations inside run()', async () => {
    const observed = await new Promise<string | undefined>((resolve) => {
      store.run({ correlationId: 'async-id' }, () => {
        setTimeout(() => resolve(store.getCorrelationId()), 0);
      });
    });

    expect(observed).toBe('async-id');
  });

  it('exposes the bound correlationId to a listener whose emit is triggered by an async continuation of run()', async () => {
    // Mirrors how CorrelationIdMiddleware relies on this: it registers
    // `res.on('finish', ...)` synchronously inside run(), but the 'finish'
    // event itself fires later via Node's internal async machinery — so the
    // propagation only holds if the emit happens on a descendant of run()'s
    // async execution chain, not from a wholly unrelated later tick.
    const emitter = new EventEmitter();

    const observed = await new Promise<string | undefined>((resolve) => {
      store.run({ correlationId: 'event-id' }, () => {
        emitter.on('finish', () => {
          resolve(store.getCorrelationId());
        });
        setImmediate(() => emitter.emit('finish'));
      });
    });

    expect(observed).toBe('event-id');
  });

  it('isolates concurrent contexts from each other', async () => {
    const results: string[] = [];

    await Promise.all([
      new Promise<void>((resolve) => {
        store.run({ correlationId: 'first' }, () => {
          setTimeout(() => {
            results.push(store.getCorrelationId() ?? 'missing');
            resolve();
          }, 10);
        });
      }),
      new Promise<void>((resolve) => {
        store.run({ correlationId: 'second' }, () => {
          setTimeout(() => {
            results.push(store.getCorrelationId() ?? 'missing');
            resolve();
          }, 5);
        });
      }),
    ]);

    expect(results.sort()).toEqual(['first', 'second']);
  });

  it('returns undefined again once run() has completed', () => {
    store.run({ correlationId: 'temporary' }, () => undefined);

    expect(store.getCorrelationId()).toBeUndefined();
  });
});
