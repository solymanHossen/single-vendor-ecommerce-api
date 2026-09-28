import { Test, type TestingModule } from '@nestjs/testing';
import { FALLBACK_SETTINGS, SettingsService } from './settings.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { SETTINGS_CACHE_KEY, SETTINGS_CACHE_TTL_SECONDS } from './settings.constants';
import { UpdateSettingsSchema } from './dto/update-settings.dto';
import type { AppSettings } from './interfaces/app-settings.interface';

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

const stored: AppSettings = {
  ...FALLBACK_SETTINGS,
  storeName: 'Nova',
  supportEmail: 'help@nova.com.bd',
  shippingFeeInsideDhaka: 70,
};

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: { client: mockRedisClient } },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    jest.clearAllMocks();
  });

  describe('getSettings()', () => {
    it('serves a cache hit without touching the database', async () => {
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(stored));

      await expect(service.getSettings()).resolves.toEqual(stored);
      expect(mockPrisma.appSetting.findUnique).not.toHaveBeenCalled();
    });

    it('fills keys missing from an older cached snapshot with defaults', async () => {
      mockRedisClient.get.mockResolvedValueOnce(
        JSON.stringify({ allowRegistration: false, enableGoogleLogin: true }),
      );

      const settings = await service.getSettings();

      expect(settings.allowRegistration).toBe(false);
      expect(settings.storeName).toBe(FALLBACK_SETTINGS.storeName);
      expect(settings.freeShippingThreshold).toBe(FALLBACK_SETTINGS.freeShippingThreshold);
    });

    it('reads the singleton row on a miss and caches it', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockPrisma.appSetting.findUnique.mockResolvedValueOnce(stored);

      await expect(service.getSettings()).resolves.toEqual(stored);

      const query = mockPrisma.appSetting.findUnique.mock.calls[0][0] as {
        where: unknown;
        select: Record<string, boolean>;
      };
      expect(query.where).toEqual({ id: 1 });
      // Selects exactly the settings keys — never id/updatedAt.
      expect(Object.keys(query.select).sort()).toEqual(Object.keys(FALLBACK_SETTINGS).sort());
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        SETTINGS_CACHE_KEY,
        JSON.stringify(stored),
        'EX',
        SETTINGS_CACHE_TTL_SECONDS,
      );
    });

    it('falls back to defaults before the row exists', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockPrisma.appSetting.findUnique.mockResolvedValueOnce(null);

      await expect(service.getSettings()).resolves.toEqual(FALLBACK_SETTINGS);
    });

    it('degrades to the database when Redis is down', async () => {
      mockRedisClient.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      mockRedisClient.set.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      mockPrisma.appSetting.findUnique.mockResolvedValueOnce(stored);

      await expect(service.getSettings()).resolves.toEqual(stored);
    });
  });

  describe('updateSettings()', () => {
    it('upserts the partial change and writes the cache through', async () => {
      mockPrisma.appSetting.upsert.mockResolvedValueOnce(stored);

      await service.updateSettings({ storeName: 'Nova' });

      expect(mockPrisma.appSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          create: { id: 1, ...FALLBACK_SETTINGS, storeName: 'Nova' },
          update: { storeName: 'Nova' },
        }),
      );
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        SETTINGS_CACHE_KEY,
        JSON.stringify(stored),
        'EX',
        SETTINGS_CACHE_TTL_SECONDS,
      );
    });
  });
});

describe('UpdateSettingsSchema', () => {
  const parse = (input: unknown) => UpdateSettingsSchema.safeParse(input);

  it('turns cleared optional fields into null', () => {
    const result = parse({ supportEmail: '', facebookUrl: '', storeAddress: '  ' });
    expect(result.success && result.data).toEqual({
      supportEmail: null,
      facebookUrl: null,
      storeAddress: null,
    });
  });

  it('accepts full https links and rejects anything else', () => {
    expect(parse({ instagramUrl: 'https://instagram.com/aura' }).success).toBe(true);
    expect(parse({ instagramUrl: 'instagram.com/aura' }).success).toBe(false);
    expect(parse({ instagramUrl: 'javascript:alert(1)' }).success).toBe(false);
  });

  it('keeps shipping amounts whole and non-negative', () => {
    expect(parse({ shippingFeeInsideDhaka: 60 }).success).toBe(true);
    expect(parse({ shippingFeeInsideDhaka: 60.5 }).success).toBe(false);
    expect(parse({ freeShippingThreshold: -1 }).success).toBe(false);
  });

  it('requires a store name when one is sent', () => {
    expect(parse({ storeName: '  ' }).success).toBe(false);
  });

  it('checks email and phone formats', () => {
    expect(parse({ supportEmail: 'nope' }).success).toBe(false);
    expect(parse({ supportPhone: '+880 9610-123456' }).success).toBe(true);
    expect(parse({ supportPhone: 'call us' }).success).toBe(false);
  });

  it('rejects empty and unknown payloads', () => {
    expect(parse({}).success).toBe(false);
    expect(parse({ theme: 'dark' }).success).toBe(false);
  });
});
