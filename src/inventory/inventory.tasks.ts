import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Role } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { MailService } from '../mail/mail.service';
import { effectivePermissions } from '../access/permissions';
import { variantLabel } from '../carts/cart-pricing';
import { InventoryService } from './inventory.service';
import { LOW_STOCK_DIGEST_LOCK, STOCK_ALERT_BATCH, STOCK_ALERT_LOCK } from './inventory.constants';

/**
 * Background inventory jobs, each behind a Redis lock so only one app
 * instance runs it: back-in-stock emails (every 10 minutes) and the
 * daily low-stock digest (09:00 Dhaka).
 */
@Injectable()
export class InventoryTasks {
  private readonly logger = new Logger(InventoryTasks.name);
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly inventory: InventoryService,
    configService: ConfigService,
  ) {
    const port = configService.get<number>('PORT') ?? 3000;
    this.appUrl = (configService.get<string>('APP_URL') ?? `http://localhost:${port}`).replace(
      /\/+$/,
      '',
    );
  }

  @Cron('*/10 * * * *', { name: 'back-in-stock' })
  async backInStockJob(): Promise<void> {
    await this.locked(STOCK_ALERT_LOCK, 600, () => this.sendBackInStock());
  }

  @Cron('0 9 * * *', { name: 'low-stock-digest', timeZone: 'Asia/Dhaka' })
  async lowStockJob(): Promise<void> {
    await this.locked(LOW_STOCK_DIGEST_LOCK, 900, () => this.sendLowStockDigest());
  }

  /** Emails shoppers whose item is available again. Returns how many were sent. */
  async sendBackInStock(): Promise<number> {
    const alerts = await this.prisma.stockAlert.findMany({
      where: {
        notifiedAt: null,
        product: { isPublished: true },
        OR: [
          { variantId: null, product: { stockQuantity: { gt: 0 } } },
          { variantId: { not: null }, variant: { stockQuantity: { gt: 0 } } },
        ],
      },
      select: {
        id: true,
        email: true,
        productId: true,
        product: { select: { name: true } },
        variant: {
          select: {
            options: {
              select: { attributeOption: { select: { value: true } } },
              orderBy: { id: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: STOCK_ALERT_BATCH,
    });

    let sent = 0;
    for (const alert of alerts) {
      try {
        await this.mail.sendBackInStockEmail({
          to: alert.email,
          productName: alert.product.name,
          variantLabel: alert.variant
            ? variantLabel(alert.variant.options.map((o) => o.attributeOption))
            : null,
          url: `${this.appUrl}/products/${alert.productId}`,
        });
        await this.prisma.stockAlert.update({
          where: { id: alert.id },
          data: { notifiedAt: new Date() },
          select: { id: true },
        });
        sent++;
      } catch (error: unknown) {
        // Left unnotified: the next run retries.
        this.logger.warn(`Back-in-stock email to alert #${alert.id} failed: ${String(error)}`);
      }
    }
    if (sent > 0) this.logger.log(`Sent ${sent} back-in-stock emails`);
    return sent;
  }

  /** One email per catalogue manager when anything is low or out. Returns recipients. */
  async sendLowStockDigest(): Promise<number> {
    const items = await this.inventory.attentionUnits(25);
    if (items.length === 0) return 0;
    const page = await this.inventory.list({ page: 1, limit: 1, level: 'all', sort: 'attention' });

    const staff = await this.prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] }, isActive: true, deletedAt: null },
      select: { email: true, role: true, staffRole: { select: { permissions: true } } },
    });
    const recipients = staff.filter((user) =>
      effectivePermissions(user.role, user.staffRole?.permissions).includes('catalog.manage'),
    );

    for (const recipient of recipients) {
      await this.mail
        .sendLowStockDigest({
          to: recipient.email,
          out: page.summary.out,
          low: page.summary.low,
          items: items.map((item) => ({
            name: item.name,
            variantLabel: item.variantLabel,
            sku: item.sku,
            onHand: item.onHand,
            daysOfCover: item.daysOfCover,
          })),
          url: `${this.appUrl}/admin/inventory?level=low`,
        })
        .catch((error: unknown) =>
          this.logger.warn(`Low-stock digest to ${recipient.email} failed: ${String(error)}`),
        );
    }
    return recipients.length;
  }

  private async locked(
    key: string,
    ttlSeconds: number,
    work: () => Promise<number>,
  ): Promise<void> {
    let locked = false;
    try {
      locked =
        (await this.redis.client.set(key, String(process.pid), 'EX', ttlSeconds, 'NX')) === 'OK';
    } catch (error: unknown) {
      this.logger.warn(`Lock ${key} unavailable, running unlocked: ${String(error)}`);
      locked = true;
    }
    if (!locked) return;
    try {
      await work();
    } catch (error: unknown) {
      this.logger.error(`${key} failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await this.redis.client.del(key).catch(() => undefined);
    }
  }
}
