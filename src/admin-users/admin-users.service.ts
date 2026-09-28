import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OrderStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { effectivePermissions } from '../access/permissions';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import type {
  AdminUserQueryDto,
  UpdateUserAccessDto,
  UpdateUserStatusDto,
} from './dto/admin-users.dto';
import {
  AdminUserCountsEntity,
  AdminUserDetailEntity,
  AdminUserEntity,
  AdminUserSessionEntity,
  AdminUserStaffRoleEntity,
  PaginatedAdminUsersEntity,
} from './entities/admin-user.entity';

const STAFF_ROLES: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];

function activeSessionWhere(now: Date): Prisma.RefreshTokenWhereInput {
  return { revokedAt: null, expiresAt: { gt: now } };
}

function userSelect(now: Date) {
  return {
    id: true,
    name: true,
    email: true,
    phone: true,
    avatarUrl: true,
    role: true,
    isActive: true,
    lockedUntil: true,
    lastLoginAt: true,
    googleId: true,
    password: true,
    createdAt: true,
    staffRole: { select: { id: true, name: true, permissions: true } },
    _count: {
      select: { orders: true, refreshTokens: { where: activeSessionWhere(now) } },
    },
  } satisfies Prisma.UserSelect;
}

type UserRow = Prisma.UserGetPayload<{ select: ReturnType<typeof userSelect> }>;

interface RequestContext {
  actor: AuthUser;
  ip?: string;
}

function label(user: { name: string | null; email: string }): string {
  return user.name ? `${user.name} (${user.email})` : user.email;
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Reads ─────────────────────────────────────────────────────────────────

  async findAll(actor: AuthUser, query: AdminUserQueryDto): Promise<PaginatedAdminUsersEntity> {
    const now = new Date();
    // Only the owner sees staff accounts; everyone else manages customers.
    const canSeeStaff = actor.role === Role.SUPER_ADMIN;
    const type = canSeeStaff ? query.type : 'customers';

    const scope: Prisma.UserWhereInput = { deletedAt: null };
    if (!canSeeStaff) scope.role = Role.USER;
    if (query.search) {
      scope.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
      ];
    }

    const where: Prisma.UserWhereInput = { ...scope };
    if (type === 'customers') where.role = Role.USER;
    if (type === 'staff') where.role = { in: STAFF_ROLES };
    if (query.status === 'active') where.isActive = true;
    if (query.status === 'inactive') where.isActive = false;
    if (query.status === 'locked') where.lockedUntil = { gt: now };

    const orderBy: Prisma.UserOrderByWithRelationInput[] =
      query.sortBy === 'lastLoginAt'
        ? [{ lastLoginAt: { sort: query.sortOrder, nulls: 'last' } }, { id: 'desc' }]
        : [{ [query.sortBy]: query.sortOrder }, { id: 'desc' }];

    const [rows, total, all, customers, inactive, locked] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: userSelect(now),
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
      this.prisma.user.count({ where: scope }),
      this.prisma.user.count({ where: { ...scope, role: Role.USER } }),
      this.prisma.user.count({ where: { ...scope, isActive: false } }),
      this.prisma.user.count({ where: { ...scope, lockedUntil: { gt: now } } }),
    ]);

    return new PaginatedAdminUsersEntity({
      items: rows.map((row) => this.toEntity(row, now)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      },
      counts: new AdminUserCountsEntity({
        all,
        customers,
        staff: canSeeStaff ? all - customers : 0,
        inactive,
        locked,
      }),
    });
  }

  async findOne(actor: AuthUser, id: number): Promise<AdminUserDetailEntity> {
    const now = new Date();
    const row = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: userSelect(now),
    });
    // Staff accounts are invisible (404, not 403) to non-owners.
    if (!row || (row.role !== Role.USER && actor.role !== Role.SUPER_ADMIN)) {
      throw new NotFoundException('User does not exist.');
    }

    const [sessions, spent, lastOrder, addressCount] = await Promise.all([
      this.prisma.refreshToken.findMany({
        where: { userId: id, ...activeSessionWhere(now) },
        select: { id: true, deviceInfo: true, createdAt: true, expiresAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.order.aggregate({
        where: { userId: id, status: OrderStatus.DELIVERED },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.findFirst({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.address.count({ where: { userId: id } }),
    ]);

    return new AdminUserDetailEntity(this.toEntity(row, now), {
      sessions: sessions.map((session) => new AdminUserSessionEntity(session)),
      totalSpent: spent._sum.totalAmount ?? new Prisma.Decimal(0),
      lastOrderAt: lastOrder?.createdAt ?? null,
      addressCount,
      permissions: effectivePermissions(row.role, row.staffRole?.permissions),
    });
  }

  // ── Account actions (customers.manage; staff targets need SUPER_ADMIN) ──

  async setStatus(
    id: number,
    dto: UpdateUserStatusDto,
    context: RequestContext,
  ): Promise<AdminUserDetailEntity> {
    const target = await this.manageableTarget(id, context.actor);
    if (target.isActive === dto.isActive) return this.findOne(context.actor, id);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { isActive: dto.isActive },
        select: { id: true },
      }),
      // A deactivated account must stop working everywhere, right now.
      ...(dto.isActive
        ? []
        : [
            this.prisma.refreshToken.updateMany({
              where: { userId: id, revokedAt: null },
              data: { revokedAt: new Date() },
            }),
          ]),
    ]);

    await this.audit.record({
      actor: context.actor,
      action: dto.isActive ? 'user.reactivated' : 'user.deactivated',
      targetType: 'user',
      targetId: id,
      summary: `${dto.isActive ? 'Reactivated' : 'Deactivated'} ${label(target)}`,
      ipAddress: context.ip,
    });
    return this.findOne(context.actor, id);
  }

  async unlock(id: number, context: RequestContext): Promise<AdminUserDetailEntity> {
    const target = await this.manageableTarget(id, context.actor);
    await this.prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
      select: { id: true },
    });
    await this.audit.record({
      actor: context.actor,
      action: 'user.unlocked',
      targetType: 'user',
      targetId: id,
      summary: `Unlocked sign-in for ${label(target)}`,
      ipAddress: context.ip,
    });
    return this.findOne(context.actor, id);
  }

  async revokeSessions(id: number, context: RequestContext): Promise<AdminUserDetailEntity> {
    const target = await this.manageableTarget(id, context.actor);
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      actor: context.actor,
      action: 'user.sessions_revoked',
      targetType: 'user',
      targetId: id,
      summary: `Signed ${label(target)} out of all devices`,
      metadata: { sessions: result.count },
      ipAddress: context.ip,
    });
    return this.findOne(context.actor, id);
  }

  async revokeSession(
    id: number,
    sessionId: number,
    context: RequestContext,
  ): Promise<AdminUserDetailEntity> {
    const target = await this.manageableTarget(id, context.actor);
    const result = await this.prisma.refreshToken.updateMany({
      where: { id: sessionId, userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException('That session has already ended.');
    await this.audit.record({
      actor: context.actor,
      action: 'user.session_revoked',
      targetType: 'user',
      targetId: id,
      summary: `Ended one session for ${label(target)}`,
      metadata: { sessionId },
      ipAddress: context.ip,
    });
    return this.findOne(context.actor, id);
  }

  // ── Access (SUPER_ADMIN only, enforced by the controller) ────────────────

  async setAccess(
    id: number,
    dto: UpdateUserAccessDto,
    context: RequestContext,
  ): Promise<AdminUserDetailEntity> {
    const target = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        staffRole: { select: { name: true } },
      },
    });
    if (!target) throw new NotFoundException('User does not exist.');
    this.assertNotSelfOrOwner(target, context.actor);

    const staffRole =
      dto.role === Role.ADMIN && dto.staffRoleId !== null
        ? await this.prisma.staffRole.findUnique({
            where: { id: dto.staffRoleId },
            select: { id: true, name: true },
          })
        : null;
    if (dto.role === Role.ADMIN && !staffRole) {
      throw new UnprocessableEntityException('That staff role no longer exists.');
    }

    await this.prisma.user.update({
      where: { id },
      data: { role: dto.role, staffRoleId: staffRole?.id ?? null },
      select: { id: true },
    });

    const before =
      target.role === Role.ADMIN ? (target.staffRole?.name ?? 'Staff (no role)') : 'Customer';
    const after = staffRole ? staffRole.name : 'Customer';
    await this.audit.record({
      actor: context.actor,
      action: 'user.access_changed',
      targetType: 'user',
      targetId: id,
      summary:
        dto.role === Role.USER
          ? `Removed staff access from ${label(target)}`
          : target.role === Role.USER
            ? `Gave ${label(target)} the “${after}” role`
            : `Changed ${label(target)} from “${before}” to “${after}”`,
      metadata: { from: before, to: after },
      ipAddress: context.ip,
    });
    return this.findOne(context.actor, id);
  }

  // ── Guardrails ────────────────────────────────────────────────────────────

  private assertNotSelfOrOwner(target: { id: number; role: Role }, actor: AuthUser): void {
    if (target.id === actor.id) {
      throw new ForbiddenException("You can't change your own account from here.");
    }
    if (target.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException("Super admin accounts can't be changed from the admin console.");
    }
  }

  /** Loads a target the actor may act on, or explains why not. */
  private async manageableTarget(id: number, actor: AuthUser) {
    const target = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    if (!target || (target.role !== Role.USER && actor.role !== Role.SUPER_ADMIN)) {
      throw new NotFoundException('User does not exist.');
    }
    this.assertNotSelfOrOwner(target, actor);
    return target;
  }

  private toEntity(row: UserRow, now: Date): AdminUserEntity {
    return new AdminUserEntity({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      avatarUrl: row.avatarUrl,
      role: row.role,
      staffRole: row.staffRole ? new AdminUserStaffRoleEntity(row.staffRole) : null,
      isActive: row.isActive,
      isLocked: !!row.lockedUntil && row.lockedUntil > now,
      lockedUntil: row.lockedUntil,
      lastLoginAt: row.lastLoginAt,
      activeSessions: row._count.refreshTokens,
      orderCount: row._count.orders,
      hasGoogle: row.googleId !== null,
      hasPassword: row.password !== null,
      createdAt: row.createdAt,
    });
  }
}
