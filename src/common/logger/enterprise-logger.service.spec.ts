import type { ConfigService } from '@nestjs/config';
import type * as winston from 'winston';
import { CorrelationIdStore } from './correlation-id.store';
import { EnterpriseLoggerService } from './enterprise-logger.service';

function buildConfigService(nodeEnv: string): ConfigService {
  return {
    get: jest.fn().mockReturnValue(nodeEnv),
  } as unknown as ConfigService;
}

function getWinstonLogSpy(service: EnterpriseLoggerService): jest.SpyInstance {
  const accessor = service as unknown as { winstonLogger: winston.Logger };
  return jest.spyOn(accessor.winstonLogger, 'log').mockReturnValue(accessor.winstonLogger);
}

describe('EnterpriseLoggerService', () => {
  let store: CorrelationIdStore;
  let service: EnterpriseLoggerService;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    store = new CorrelationIdStore();
    service = new EnterpriseLoggerService(store, buildConfigService('development'));
    logSpy = getWinstonLogSpy(service);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('maps log() to the info level with no metadata outside a request context', () => {
    service.log('hello world');

    expect(logSpy).toHaveBeenCalledWith('info', 'hello world', {});
  });

  it('appends the bound context as metadata (Nest always passes it last)', () => {
    service.log('user created', 'UsersService');

    expect(logSpy).toHaveBeenCalledWith('info', 'user created', { context: 'UsersService' });
  });

  it('extracts the correlation id from CorrelationIdStore when a request is in flight', () => {
    store.run({ correlationId: 'req-123' }, () => {
      service.log('handled request', 'AppController');
    });

    expect(logSpy).toHaveBeenCalledWith('info', 'handled request', {
      context: 'AppController',
      correlationId: 'req-123',
    });
  });

  it('maps warn()/debug()/verbose()/fatal() to their matching winston levels', () => {
    service.warn('careful');
    service.debug('detail');
    service.verbose('chatty');
    service.fatal('boom');

    expect(logSpy).toHaveBeenNthCalledWith(1, 'warn', 'careful', {});
    expect(logSpy).toHaveBeenNthCalledWith(2, 'debug', 'detail', {});
    expect(logSpy).toHaveBeenNthCalledWith(3, 'verbose', 'chatty', {});
    expect(logSpy).toHaveBeenNthCalledWith(4, 'fatal', 'boom', {});
  });

  it('extracts the trace as the second-to-last arg on error() with a bound context', () => {
    service.error('save failed', 'stack trace here', 'UsersService');

    expect(logSpy).toHaveBeenCalledWith('error', 'save failed', {
      context: 'UsersService',
      trace: 'stack trace here',
    });
  });

  it('pulls message and stack directly off an Error instance', () => {
    const error = new Error('boom');

    service.error(error, 'UsersService');

    expect(logSpy).toHaveBeenCalledWith('error', 'boom', {
      context: 'UsersService',
      trace: error.stack,
    });
  });

  it('JSON-stringifies non-string, non-Error messages', () => {
    service.log({ userId: 42 });

    expect(logSpy).toHaveBeenCalledWith('info', JSON.stringify({ userId: 42 }), {});
  });

  it('setLogLevels() is a no-op that never throws', () => {
    expect(() => service.setLogLevels(['debug'])).not.toThrow();
  });
});
