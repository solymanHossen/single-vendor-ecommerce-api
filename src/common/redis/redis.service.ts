import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Owns the single ioredis connection shared by every Redis-backed concern in
 * the app (currently: distributed Throttler storage). Mirrors PrismaService's
 * pattern of constructing its own client and closing it explicitly on
 * shutdown, rather than leaving lifecycle management to a third-party library.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  /** The shared ioredis client. Public so downstream consumers (e.g. the
   * Throttler's Redis storage adapter) can hand it off directly. */
  public readonly client: Redis;

  constructor(configService: ConfigService) {
    const redisUrl = configService.getOrThrow<string>('REDIS_URL');

    this.client = new Redis(redisUrl, {
      // Bound retry attempts per command so a Redis outage fails fast with a
      // clear error instead of hanging requests indefinitely.
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      // Reconnect with capped exponential backoff rather than a fixed delay.
      retryStrategy: (attempt: number): number => Math.min(attempt * 200, 5_000),
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis connection error: ${error.message}`, error.stack);
    });

    this.client.on('connect', () => {
      this.logger.log('✅ Redis connected successfully.');
    });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.log('📉 Redis connection closed gracefully.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Error during Redis disconnect: ${message}`);
    }
  }
}
