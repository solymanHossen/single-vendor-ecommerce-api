import { Test, type TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { SETTINGS_CACHE_KEY, SETTINGS_CACHE_TTL_SECONDS } from './settings.constants';

const mockPrisma = {
  appSetting: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
};

const mockRedisService = {
  client: mockRedisClient,
};

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    jest.clearAllMocks();
  });

  describe('getSettings()', () => {
    it('returns the cached value without querying the database on a cache hit', async () => {
      mockRedisClient.get.mockResolvedValueOnce(
        JSON.stringify({ allowRegistration: false, enableGoogleLogin: true }),
      );

      const result = await service.getSettings();

      expect(result).toEqual({ allowRegistration: false, enableGoogleLogin: true });
      expect(mockRedisClient.get).toHaveBeenCalledWith(SETTINGS_CACHE_KEY);
      expect(mockPrisma.appSetting.findUnique).not.toHaveBeenCalled();
    });

    it('falls back to the database and populates the cache on a cache miss', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockPrisma.appSetting.findUnique.mockResolvedValueOnce({
        allowRegistration: true,
        enableGoogleLogin: false,
      });

      const result = await service.getSettings();

      expect(result).toEqual({ allowRegistration: true, enableGoogleLogin: false });
      expect(mockPrisma.appSetting.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { allowRegistration: true, enableGoogleLogin: true },
      });
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        SETTINGS_CACHE_KEY,
        JSON.stringify({ allowRegistration: true, enableGoogleLogin: false }),
        'EX',
        SETTINGS_CACHE_TTL_SECONDS,
      );
    });

    it('falls back to permissive defaults when no settings row exists yet', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockPrisma.appSetting.findUnique.mockResolvedValueOnce(null);

      const result = await service.getSettings();

      expect(result).toEqual({ allowRegistration: true, enableGoogleLogin: true });
    });

    it('falls back to the database when the cache read throws', async () => {
      mockRedisClient.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      mockPrisma.appSetting.findUnique.mockResolvedValueOnce({
        allowRegistration: true,
        enableGoogleLogin: true,
      });

      const result = await service.getSettings();

      expect(result).toEqual({ allowRegistration: true, enableGoogleLogin: true });
      expect(mockPrisma.appSetting.findUnique).toHaveBeenCalledTimes(1);
    });

    it('still returns the database value when the cache write fails', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockPrisma.appSetting.findUnique.mockResolvedValueOnce({
        allowRegistration: true,
        enableGoogleLogin: true,
      });
      mockRedisClient.set.mockRejectedValueOnce(new Error('connection reset'));

      await expect(service.getSettings()).resolves.toEqual({
        allowRegistration: true,
        enableGoogleLogin: true,
      });
    });
  });

  describe('updateSettings()', () => {
    it('persists the partial update and refreshes the cache', async () => {
      mockPrisma.appSetting.upsert.mockResolvedValueOnce({
        allowRegistration: false,
        enableGoogleLogin: true,
      });

      const result = await service.updateSettings({ allowRegistration: false });

      expect(mockPrisma.appSetting.upsert).toHaveBeenCalledWith({
        where: { id: 1 },
        create: { id: 1, allowRegistration: false, enableGoogleLogin: true },
        update: { allowRegistration: false },
        select: { allowRegistration: true, enableGoogleLogin: true },
      });
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        SETTINGS_CACHE_KEY,
        JSON.stringify({ allowRegistration: false, enableGoogleLogin: true }),
        'EX',
        SETTINGS_CACHE_TTL_SECONDS,
      );
      expect(result).toEqual({ allowRegistration: false, enableGoogleLogin: true });
    });

    it('still returns the updated row when the cache write fails', async () => {
      mockPrisma.appSetting.upsert.mockResolvedValueOnce({
        allowRegistration: true,
        enableGoogleLogin: false,
      });
      mockRedisClient.set.mockRejectedValueOnce(new Error('connection reset'));

      await expect(service.updateSettings({ enableGoogleLogin: false })).resolves.toEqual({
        allowRegistration: true,
        enableGoogleLogin: false,
      });
    });
  });
});
