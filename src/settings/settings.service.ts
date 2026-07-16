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
const FALLBACK_SETTINGS: AppSettings = {
  allowRegistration: true,
  enableGoogleLogin: true,
};

const SETTINGS_SELECT = { allowRegistration: true, enableGoogleLogin: true } as const;

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
   * This is read on every `register()` and `googleLogin()` call in
   * AuthService, so caching it turns those hot paths from "extra Postgres
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

    const settings = row ?? FALLBACK_SETTINGS;
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
      return cached ? (JSON.parse(cached) as AppSettings) : null;
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
