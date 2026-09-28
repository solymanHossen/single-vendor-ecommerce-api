import { ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PERMISSION_GROUPS, isPermission } from '../access/permissions';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import type { CreateStaffRoleDto, UpdateStaffRoleDto } from './dto/staff-role.dto';
import { PermissionGroupEntity, StaffRoleEntity } from './entities/staff-role.entity';

const STAFF_ROLE_SELECT = {
  id: true,
  name: true,
  description: true,
  permissions: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { users: true } },
} satisfies Prisma.StaffRoleSelect;

type StaffRoleRow = Prisma.StaffRoleGetPayload<{ select: typeof STAFF_ROLE_SELECT }>;

interface RequestContext {
  actor: AuthUser;
  ip?: string;
}

@Injectable()
export class StaffRolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  permissionCatalog(): PermissionGroupEntity[] {
    return PERMISSION_GROUPS.map((group) => ({
      key: group.key,
      label: group.label,
      permissions: group.permissions.map((permission) => ({ ...permission })),
    }));
  }

  async findAll(): Promise<StaffRoleEntity[]> {
    const rows = await this.prisma.staffRole.findMany({
      select: STAFF_ROLE_SELECT,
      orderBy: [{ name: 'asc' }],
    });
    return rows.map((row) => this.toEntity(row));
  }

  async create(dto: CreateStaffRoleDto, context: RequestContext): Promise<StaffRoleEntity> {
    const row = await this.prisma.staffRole.create({ data: dto, select: STAFF_ROLE_SELECT });
    await this.audit.record({
      actor: context.actor,
      action: 'role.created',
      targetType: 'role',
      targetId: row.id,
      summary: `Created the “${row.name}” role with ${row.permissions.length} permissions`,
      metadata: { permissions: row.permissions },
      ipAddress: context.ip,
    });
    return this.toEntity(row);
  }

  async update(
    id: number,
    dto: UpdateStaffRoleDto,
    context: RequestContext,
  ): Promise<StaffRoleEntity> {
    const before = await this.prisma.staffRole.findUniqueOrThrow({
      where: { id },
      select: { name: true, permissions: true },
    });
    const row = await this.prisma.staffRole.update({
      where: { id },
      data: dto,
      select: STAFF_ROLE_SELECT,
    });

    const added = row.permissions.filter((key) => !before.permissions.includes(key));
    const removed = before.permissions.filter((key) => !row.permissions.includes(key));
    const changes = [
      before.name !== row.name && `renamed from “${before.name}”`,
      added.length > 0 && `+${added.length} permissions`,
      removed.length > 0 && `−${removed.length} permissions`,
    ].filter(Boolean);
    await this.audit.record({
      actor: context.actor,
      action: 'role.updated',
      targetType: 'role',
      targetId: id,
      summary: `Updated the “${row.name}” role${changes.length ? ` (${changes.join(', ')})` : ''}`,
      metadata: { added, removed, members: row._count.users },
      ipAddress: context.ip,
    });
    return this.toEntity(row);
  }

  async remove(id: number, context: RequestContext): Promise<void> {
    const role = await this.prisma.staffRole.findUniqueOrThrow({
      where: { id },
      select: { name: true, _count: { select: { users: true } } },
    });
    // Deleting would silently strip access from its members — make the
    // owner reassign them deliberately first.
    if (role._count.users > 0) {
      throw new ConflictException(
        `“${role.name}” is assigned to ${role._count.users} staff ${role._count.users === 1 ? 'member' : 'members'}. Give them another role first.`,
      );
    }
    await this.prisma.staffRole.delete({ where: { id }, select: { id: true } });
    await this.audit.record({
      actor: context.actor,
      action: 'role.deleted',
      targetType: 'role',
      targetId: id,
      summary: `Deleted the “${role.name}” role`,
      ipAddress: context.ip,
    });
  }

  private toEntity(row: StaffRoleRow): StaffRoleEntity {
    return new StaffRoleEntity({
      id: row.id,
      name: row.name,
      description: row.description,
      permissions: row.permissions.filter(isPermission),
      memberCount: row._count.users,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
