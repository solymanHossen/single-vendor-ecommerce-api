import type { NextFunction, Request, Response } from 'express';
import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { CorrelationIdStore } from './correlation-id.store';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildRequest(headers: Record<string, string | string[] | undefined>): Request {
  return { headers } as unknown as Request;
}

// Kept as a plain object (not typed `Response`) so `setHeader` stays a
// function-typed property rather than the "method" shape Express's Response
// interface declares — the latter trips @typescript-eslint/unbound-method on
// `expect(res.setHeader)` below.
function buildResponse() {
  return { setHeader: jest.fn() };
}

describe('CorrelationIdMiddleware', () => {
  let store: CorrelationIdStore;
  let middleware: CorrelationIdMiddleware;
  let next: NextFunction;

  beforeEach(() => {
    store = new CorrelationIdStore();
    middleware = new CorrelationIdMiddleware(store);
    next = jest.fn();
  });

  it('generates a new UUIDv4 when no incoming header is present', () => {
    const req = buildRequest({});
    const res = buildResponse();

    middleware.use(req, res as unknown as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Correlation-ID',
      expect.stringMatching(UUID_PATTERN),
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('reuses the incoming x-correlation-id header when present', () => {
    const req = buildRequest({ 'x-correlation-id': 'client-supplied-id' });
    const res = buildResponse();

    middleware.use(req, res as unknown as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-ID', 'client-supplied-id');
  });

  it('takes the first value when the header arrives duplicated', () => {
    const req = buildRequest({ 'x-correlation-id': ['first-id', 'second-id'] });
    const res = buildResponse();

    middleware.use(req, res as unknown as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-ID', 'first-id');
  });

  it('falls back to a generated id when the incoming header is blank', () => {
    const req = buildRequest({ 'x-correlation-id': '   ' });
    const res = buildResponse();

    middleware.use(req, res as unknown as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Correlation-ID',
      expect.stringMatching(UUID_PATTERN),
    );
  });

  it('binds the resolved correlation id to the store before calling next()', () => {
    const req = buildRequest({ 'x-correlation-id': 'bound-id' });
    const res = buildResponse();
    let observedDuringNext: string | undefined;

    next = jest.fn(() => {
      observedDuringNext = store.getCorrelationId();
    });

    middleware.use(req, res as unknown as Response, next);

    expect(observedDuringNext).toBe('bound-id');
    expect(store.getCorrelationId()).toBeUndefined();
  });
});
