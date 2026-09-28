import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { SETTINGS_CACHE_KEY, SETTINGS_CACHE_TTL_SECONDS } from './settings.constants';
import { AppSettings } from './interfaces/app-settings.interface';
import { UpdateSettingsDto } from './dto/update-settings.dto';

/**
 * Values used the very first time the app boots against a fresh database,
 * before the seed script has inserted the singleton `app_settings` row.
 */
export const FALLBACK_SETTINGS: AppSettings = {
  allowRegistration: true,
  enableGoogleLogin: true,
  storeName: 'AURA',
  tagline: 'Next-gen tech & streetwear',
  logoUrl: null,
  faviconUrl: null,
  supportEmail: null,
  supportPhone: null,
  whatsappNumber: null,
  storeAddress: null,
  businessHours: null,
  facebookUrl: null,
  instagramUrl: null,
  youtubeUrl: null,
  tiktokUrl: null,
  shippingFeeInsideDhaka: 60,
  shippingFeeOutsideDhaka: 120,
  freeShippingThreshold: 10_000,
  announcementEnabled: true,
  announcementMessage: '100% authentic products · Cash on delivery nationwide · 7-day easy returns',
  announcementPromotion: true,
  metaTitle: null,
  metaDescription: null,
};

// Selects exactly the AppSettings keys (and nothing else, e.g. id/updatedAt).
const SETTINGS_SELECT = Object.fromEntries(
  Object.keys(FALLBACK_SETTINGS).map((key) => [key, true]),
) as { [K in keyof AppSettings]: true };

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Read-through cache in front of the `app_settings` singleton row.
   *
   * This is read on every storefront render (branding, announcement),
   * every checkout quote (shipping rules), and every `register()` /
   * `googleLogin()` call in AuthService, so caching it turns those hot paths from "extra Postgres
   * round-trip per request" into "extra Redis round-trip, TTL-bounded". A
   * Redis outage degrades to hitting Postgres directly rather than failing
   * the request — this cache is a performance optimization, not a
   * correctness dependency.
   */
  async getSettings(): Promise<AppSettings> {
    const cached = await this.readCache();
    if (cached) return cached;

    const row = await this.prisma.appSetting.findUnique({
      where: { id: 1 },
      select: SETTINGS_SELECT,
    });

    const settings: AppSettings = row ?? FALLBACK_SETTINGS;
    await this.writeCache(settings);

    return settings;
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<AppSettings> {
    const settings = await this.prisma.appSetting.upsert({
      where: { id: 1 },
      create: { id: 1, ...FALLBACK_SETTINGS, ...dto },
      update: dto,
      select: SETTINGS_SELECT,
    });

    // Write-through: keep the cache authoritative immediately rather than
    // waiting for it to expire, so a read right after this update never
    // serves the stale pre-update value.
    await this.writeCache(settings);

    return settings;
  }

  private async readCache(): Promise<AppSettings | null> {
    try {
      const cached = await this.redis.client.get(SETTINGS_CACHE_KEY);
      if (!cached) return null;
      // A snapshot cached before new settings existed is missing keys — fill
      // them from the defaults rather than serving undefined.
      return { ...FALLBACK_SETTINGS, ...(JSON.parse(cached) as Partial<AppSettings>) };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Settings cache read failed, falling back to database: ${message}`);
      return null;
    }
  }

  private async writeCache(settings: AppSettings): Promise<void> {
    try {
      await this.redis.client.set(
        SETTINGS_CACHE_KEY,
        JSON.stringify(settings),
        'EX',
        SETTINGS_CACHE_TTL_SECONDS,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Settings cache write failed: ${message}`);
    }
  }
}
