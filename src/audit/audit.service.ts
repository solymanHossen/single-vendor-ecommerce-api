import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  AUDIT_PURGE_BATCH_SIZE,
  DEFAULT_AUDIT_RETENTION_DAYS,
  type AuditAction,
} from './audit.constants';
import type { AuditQueryDto } from './dto/audit-query.dto';
import {
  AuditActorEntity,
  AuditLogEntity,
  PaginatedAuditLogsEntity,
} from './entities/audit-log.entity';

export interface AuditEvent {
  /** Who did it; null for system events (e.g. an automatic lockout). */
  actor: { id: number; email: string } | null;
  action: AuditAction;
  targetType: 'user' | 'role' | 'settings';
  targetId?: string | number | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  /** History older than this is hidden from reads and purged nightly. */
  readonly retentionDays: number;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.retentionDays =
      configService.get<number>('AUDIT_LOG_RETENTION_DAYS') ?? DEFAULT_AUDIT_RETENTION_DAYS;
  }

  /** Oldest moment still inside the retention window. */
  retentionCutoff(now: Date = new Date()): Date {
    return new Date(now.getTime() - this.retentionDays * 86_400_000);
  }

  /**
   * Best-effort: an audit write must never fail the action it describes
   * (the change already happened). Failures are logged loudly instead.
   */
  async record(event: AuditEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: event.actor?.id ?? null,
          actorEmail: event.actor?.email ?? null,
          action: event.action,
          targetType: event.targetType,
          targetId:
            event.targetId === undefined || event.targetId === null ? null : String(event.targetId),
          summary: event.summary,
          metadata: event.metadata,
          ipAddress: event.ipAddress?.slice(0, 64) ?? null,
        },
        select: { id: true },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to write audit log "${event.action}": ${message}`);
    }
  }

  async findAll(query: AuditQueryDto): Promise<PaginatedAuditLogsEntity> {
    // Only the retention window, even before tonight's purge has run.
    const where: Prisma.AuditLogWhereInput = { createdAt: { gte: this.retentionCutoff() } };
    if (query.area) where.action = { startsWith: `${query.area}.` };
    if (query.actorId) where.actorId = query.actorId;
    if (query.targetType) where.targetType = query.targetType;
    if (query.targetId) where.targetId = query.targetId;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          actorEmail: true,
          action: true,
          targetType: true,
          targetId: true,
          summary: true,
          metadata: true,
          ipAddress: true,
          createdAt: true,
          actor: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return new PaginatedAuditLogsEntity({
      items: rows.map(
        (row) =>
          new AuditLogEntity({
            ...row,
            actor: row.actor ? new AuditActorEntity(row.actor) : null,
          }),
      ),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      },
      retentionDays: this.retentionDays,
    });
  }

  /**
   * Deletes entries older than the retention window in small id-ordered
   * batches (uses the created_at index; each statement is short, so it never
   * blocks inserts for long). Returns how many rows were removed.
   */
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const cutoff = this.retentionCutoff(now);
    let removed = 0;
    for (;;) {
      const deleted = await this.prisma.$executeRaw`
        DELETE FROM audit_logs
        WHERE id IN (
          SELECT id FROM audit_logs
          WHERE created_at < ${cutoff}
          ORDER BY id
          LIMIT ${AUDIT_PURGE_BATCH_SIZE}
        )`;
      removed += deleted;
      if (deleted < AUDIT_PURGE_BATCH_SIZE) return removed;
    }
  }
}
