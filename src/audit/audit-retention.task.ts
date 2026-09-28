import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisService } from '../common/redis/redis.service';
import { AUDIT_PURGE_LOCK_KEY, AUDIT_PURGE_LOCK_TTL_SECONDS } from './audit.constants';
import { AuditService } from './audit.service';

/**
 * Keeps the audit_logs table to its retention window (default 90 days).
 * Runs nightly and once at startup; a Redis lock makes sure only one app
 * instance purges at a time when several are running.
 */
@Injectable()
export class AuditRetentionTask implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuditRetentionTask.name);

  constructor(
    private readonly audit: AuditService,
    private readonly redis: RedisService,
  ) {}

  onApplicationBootstrap(): void {
    // Don't hold up startup; catch up on anything that expired while down.
    setTimeout(() => void this.run(), 30_000).unref();
  }

  @Cron('0 3 * * *', { name: 'audit-log-retention', timeZone: 'Asia/Dhaka' })
  async nightly(): Promise<void> {
    await this.run();
  }

  /** Returns rows removed, or null when another instance holds the lock. */
  async run(): Promise<number | null> {
    let locked = false;
    try {
      locked =
        (await this.redis.client.set(
          AUDIT_PURGE_LOCK_KEY,
          String(process.pid),
          'EX',
          AUDIT_PURGE_LOCK_TTL_SECONDS,
          'NX',
        )) === 'OK';
    } catch (error: unknown) {
      // Redis down: still purge — deleting expired rows twice is harmless.
      this.logger.warn(`Purge lock unavailable, running unlocked: ${String(error)}`);
      locked = true;
    }
    if (!locked) return null;

    try {
      const removed = await this.audit.purgeExpired();
      if (removed > 0) {
        this.logger.log(
          `Purged ${removed} audit log entries older than ${this.audit.retentionDays} days`,
        );
      }
      return removed;
    } catch (error: unknown) {
      this.logger.error(
        `Audit log purge failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    } finally {
      await this.redis.client.del(AUDIT_PURGE_LOCK_KEY).catch(() => undefined);
    }
  }
}
