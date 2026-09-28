import { ApiProperty } from '@nestjs/swagger';
import type { Prisma, Role } from '@prisma/client';
import type { Permission } from '../../access/permissions';

export class AdminUserStaffRoleEntity {
  @ApiProperty({ example: 2 })
  id: number;

  @ApiProperty({ example: 'Order manager' })
  name: string;

  constructor(partial: AdminUserStaffRoleEntity) {
    this.id = partial.id;
    this.name = partial.name;
  }
}

export class AdminUserEntity {
  @ApiProperty({ example: 17 })
  id: number;

  @ApiProperty({ nullable: true, example: 'Rafi Ahmed' })
  name: string | null;

  @ApiProperty({ example: 'rafi@example.com' })
  email: string;

  @ApiProperty({ nullable: true, example: '01712345678' })
  phone: string | null;

  @ApiProperty({ nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ enum: ['USER', 'ADMIN', 'SUPER_ADMIN'] })
  role: Role;

  @ApiProperty({ type: () => AdminUserStaffRoleEntity, nullable: true })
  staffRole: AdminUserStaffRoleEntity | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: false, description: 'Temporarily locked after repeated failed sign-ins' })
  isLocked: boolean;

  @ApiProperty({ nullable: true })
  lockedUntil: Date | null;

  @ApiProperty({ nullable: true, description: 'Most recent successful sign-in' })
  lastLoginAt: Date | null;

  @ApiProperty({ example: 2, description: 'Signed-in sessions that are still valid' })
  activeSessions: number;

  @ApiProperty({ example: 5 })
  orderCount: number;

  @ApiProperty({ example: true, description: 'Signs in with Google' })
  hasGoogle: boolean;

  @ApiProperty({ example: true, description: 'Has a password set' })
  hasPassword: boolean;

  @ApiProperty()
  createdAt: Date;

  constructor(partial: AdminUserEntity) {
    this.id = partial.id;
    this.name = partial.name;
    this.email = partial.email;
    this.phone = partial.phone;
    this.avatarUrl = partial.avatarUrl;
    this.role = partial.role;
    this.staffRole = partial.staffRole;
    this.isActive = partial.isActive;
    this.isLocked = partial.isLocked;
    this.lockedUntil = partial.lockedUntil;
    this.lastLoginAt = partial.lastLoginAt;
    this.activeSessions = partial.activeSessions;
    this.orderCount = partial.orderCount;
    this.hasGoogle = partial.hasGoogle;
    this.hasPassword = partial.hasPassword;
    this.createdAt = partial.createdAt;
  }
}

export class AdminUserSessionEntity {
  @ApiProperty({ example: 88 })
  id: number;

  @ApiProperty({ nullable: true, example: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) …' })
  deviceInfo: string | null;

  @ApiProperty({ description: 'When this sign-in happened' })
  createdAt: Date;

  @ApiProperty()
  expiresAt: Date;

  constructor(partial: AdminUserSessionEntity) {
    this.id = partial.id;
    this.deviceInfo = partial.deviceInfo;
    this.createdAt = partial.createdAt;
    this.expiresAt = partial.expiresAt;
  }
}

export class AdminUserDetailEntity extends AdminUserEntity {
  @ApiProperty({ type: () => AdminUserSessionEntity, isArray: true })
  sessions: AdminUserSessionEntity[];

  @ApiProperty({ type: String, example: '48250.00', description: 'Sum of delivered order totals' })
  totalSpent: Prisma.Decimal;

  @ApiProperty({ nullable: true })
  lastOrderAt: Date | null;

  @ApiProperty({ example: 2 })
  addressCount: number;

  @ApiProperty({ isArray: true, example: ['orders.view'], description: 'Effective permissions' })
  permissions: Permission[];

  constructor(
    base: AdminUserEntity,
    extra: {
      sessions: AdminUserSessionEntity[];
      totalSpent: Prisma.Decimal;
      lastOrderAt: Date | null;
      addressCount: number;
      permissions: Permission[];
    },
  ) {
    super(base);
    this.sessions = extra.sessions;
    this.totalSpent = extra.totalSpent;
    this.lastOrderAt = extra.lastOrderAt;
    this.addressCount = extra.addressCount;
    this.permissions = extra.permissions;
  }
}

export class AdminUserCountsEntity {
  @ApiProperty({ example: 120 })
  all: number;

  @ApiProperty({ example: 112 })
  customers: number;

  @ApiProperty({ example: 8 })
  staff: number;

  @ApiProperty({ example: 3 })
  inactive: number;

  @ApiProperty({ example: 1 })
  locked: number;

  constructor(partial: AdminUserCountsEntity) {
    this.all = partial.all;
    this.customers = partial.customers;
    this.staff = partial.staff;
    this.inactive = partial.inactive;
    this.locked = partial.locked;
  }
}

export class PaginatedAdminUsersEntity {
  @ApiProperty({ type: () => AdminUserEntity, isArray: true })
  items: AdminUserEntity[];

  @ApiProperty({ example: { page: 1, limit: 20, total: 120, totalPages: 6 } })
  meta: { page: number; limit: number; total: number; totalPages: number };

  @ApiProperty({ type: () => AdminUserCountsEntity })
  counts: AdminUserCountsEntity;

  constructor(partial: PaginatedAdminUsersEntity) {
    this.items = partial.items;
    this.meta = partial.meta;
    this.counts = partial.counts;
  }
}
