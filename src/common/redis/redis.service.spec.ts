import type { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
  })),
}));

interface MockRedisClient {
  on: jest.Mock;
  quit: jest.Mock;
}

function buildConfigService(redisUrl: string): ConfigService {
  return {
    getOrThrow: jest.fn().mockReturnValue(redisUrl),
  } as unknown as ConfigService;
}

// `service.client` is typed as ioredis's real `Redis` class, whose methods use
// method-shorthand syntax — asserting on them directly trips
// @typescript-eslint/unbound-method. Re-viewing the mock through a plain
// structural type keeps the assertions type-safe without that false positive.
function asMockClient(service: RedisService): MockRedisClient {
  return service.client as unknown as MockRedisClient;
}

describe('RedisService', () => {
  beforeEach(() => {
    jest.mocked(Redis).mockClear();
  });

  it('constructs the ioredis client from REDIS_URL with a bounded retry policy', () => {
    const configService = buildConfigService('redis://localhost:6379');

    new RedisService(configService);

    expect(jest.mocked(Redis)).toHaveBeenCalledWith(
      'redis://localhost:6379',
      expect.objectContaining({ maxRetriesPerRequest: 3, enableReadyCheck: true }),
    );
  });

  it('registers error and connect event handlers on the client', () => {
    const configService = buildConfigService('redis://localhost:6379');

    const service = new RedisService(configService);
    const mockClient = asMockClient(service);

    expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockClient.on).toHaveBeenCalledWith('connect', expect.any(Function));
  });

  it('quits the client gracefully on module destroy', async () => {
    const configService = buildConfigService('redis://localhost:6379');
    const service = new RedisService(configService);
    const mockClient = asMockClient(service);

    await service.onModuleDestroy();

    expect(mockClient.quit).toHaveBeenCalledTimes(1);
  });

  it('swallows and logs an error if quitting the client fails', async () => {
    const configService = buildConfigService('redis://localhost:6379');
    const service = new RedisService(configService);
    const mockClient = asMockClient(service);
    mockClient.quit.mockRejectedValueOnce(new Error('connection reset'));

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});
