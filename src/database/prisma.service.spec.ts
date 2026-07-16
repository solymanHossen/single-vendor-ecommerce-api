import type { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

const mockPoolEnd = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({ end: mockPoolEnd })),
}));

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({})),
}));

const mockQueryRaw = jest.fn();
const mockDisconnect = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: class {
    $queryRaw = mockQueryRaw;
    $disconnect = mockDisconnect;
  },
}));

function buildConfigService(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
    NODE_ENV: 'test',
    ...overrides,
  };

  return {
    getOrThrow: jest.fn((key: string) => {
      const value = values[key];
      if (value === undefined) {
        throw new Error(`Missing required config value: ${key}`);
      }
      return value;
    }),
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('PrismaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPoolEnd.mockResolvedValue(undefined);
    mockDisconnect.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('onModuleInit', () => {
    it('connects successfully on the first attempt', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
      const service = new PrismaService(buildConfigService());

      await expect(service.onModuleInit()).resolves.toBeUndefined();
      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    });

    it('retries with exponential backoff and eventually succeeds', async () => {
      jest.useFakeTimers();
      mockQueryRaw
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce([{ '?column?': 1 }]);

      const service = new PrismaService(buildConfigService());
      const initPromise = service.onModuleInit();

      await jest.advanceTimersByTimeAsync(1_000);
      await jest.advanceTimersByTimeAsync(2_000);

      await expect(initPromise).resolves.toBeUndefined();
      expect(mockQueryRaw).toHaveBeenCalledTimes(3);
    });

    it('throws after exhausting all retry attempts', async () => {
      jest.useFakeTimers();
      mockQueryRaw.mockRejectedValue(new Error('ECONNREFUSED'));

      const service = new PrismaService(buildConfigService());
      const initPromise = service.onModuleInit();
      initPromise.catch(() => undefined);

      await jest.advanceTimersByTimeAsync(1_000);
      await jest.advanceTimersByTimeAsync(2_000);
      await jest.advanceTimersByTimeAsync(4_000);
      await jest.advanceTimersByTimeAsync(8_000);

      await expect(initPromise).rejects.toThrow('Database connection failed after 5 attempts');
      expect(mockQueryRaw).toHaveBeenCalledTimes(5);
    });
  });

  describe('onModuleDestroy', () => {
    it('disconnects the client and closes the pool gracefully', async () => {
      const service = new PrismaService(buildConfigService());

      await service.onModuleDestroy();

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
      expect(mockPoolEnd).toHaveBeenCalledTimes(1);
    });

    it('swallows and logs an error if disconnecting fails', async () => {
      mockDisconnect.mockRejectedValueOnce(new Error('disconnect failed'));
      const service = new PrismaService(buildConfigService());

      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
  });
});
