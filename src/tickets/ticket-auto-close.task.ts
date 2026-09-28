import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisService } from '../common/redis/redis.service';
import { AdminTicketsService } from './admin-tickets.service';
import { AUTO_CLOSE_AFTER_DAYS, TICKET_AUTO_CLOSE_LOCK_KEY } from './tickets.constants';

/** Hourly: resolved tickets with no reply for a week become closed. */
@Injectable()
export class TicketAutoCloseTask {
  private readonly logger = new Logger(TicketAutoCloseTask.name);

  constructor(
    private readonly tickets: AdminTicketsService,
    private readonly redis: RedisService,
  ) {}

  @Cron('15 * * * *', { name: 'ticket-auto-close' })
  async hourly(): Promise<void> {
    await this.run();
  }

  /** Returns tickets closed, or null when another instance holds the lock. */
  async run(): Promise<number | null> {
    let locked = false;
    try {
      locked =
        (await this.redis.client.set(
          TICKET_AUTO_CLOSE_LOCK_KEY,
          String(process.pid),
          'EX',
          600,
          'NX',
        )) === 'OK';
    } catch (error: unknown) {
      // Redis down: still run — closing is idempotent (status is re-checked).
      this.logger.warn(`Auto-close lock unavailable, running unlocked: ${String(error)}`);
      locked = true;
    }
    if (!locked) return null;

    try {
      const closed = await this.tickets.closeStale();
      if (closed > 0) {
        this.logger.log(`Closed ${closed} tickets resolved over ${AUTO_CLOSE_AFTER_DAYS} days ago`);
      }
      return closed;
    } catch (error: unknown) {
      this.logger.error(
        `Ticket auto-close failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    } finally {
      await this.redis.client.del(TICKET_AUTO_CLOSE_LOCK_KEY).catch(() => undefined);
    }
  }
}
