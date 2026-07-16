import { Logger } from '@nestjs/common';

// Several specs (PrismaService retry/disconnect, the exception filters, RedisService)
// intentionally trigger error/warn paths to assert they're handled gracefully. That's
// correct behavior, but it floods `jest` stdout with expected Logger output. Silence
// Nest's Logger for the whole suite; nothing asserts on its output directly.
beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => undefined);
});

afterAll(() => {
  jest.restoreAllMocks();
});
