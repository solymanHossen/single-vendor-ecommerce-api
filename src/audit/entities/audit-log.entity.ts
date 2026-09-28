import { ApiProperty } from '@nestjs/swagger';

export class AuditActorEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ nullable: true, example: 'Super Admin' })
  name: string | null;

  @ApiProperty({ example: 'superadmin@example.com' })
  email: string;

  constructor(partial: AuditActorEntity) {
    this.id = partial.id;
    this.name = partial.name;
    this.email = partial.email;
  }
}

export class AuditLogEntity {
  @ApiProperty({ example: 42 })
  id: number;

  @ApiProperty({
    type: () => AuditActorEntity,
    nullable: true,
    description: 'Null for system events',
  })
  actor: AuditActorEntity | null;

  @ApiProperty({
    nullable: true,
    example: 'superadmin@example.com',
    description: 'Kept after the actor is removed',
  })
  actorEmail: string | null;

  @ApiProperty({ example: 'user.access_changed' })
  action: string;

  @ApiProperty({ example: 'user' })
  targetType: string;

  @ApiProperty({ nullable: true, example: '17' })
  targetId: string | null;

  @ApiProperty({ example: 'Gave rafi@example.com the “Order manager” role' })
  summary: string;

  @ApiProperty({ nullable: true, type: Object })
  metadata: unknown;

  @ApiProperty({ nullable: true, example: '203.0.113.7' })
  ipAddress: string | null;

  @ApiProperty()
  createdAt: Date;

  constructor(partial: AuditLogEntity) {
    this.id = partial.id;
    this.actor = partial.actor;
    this.actorEmail = partial.actorEmail;
    this.action = partial.action;
    this.targetType = partial.targetType;
    this.targetId = partial.targetId;
    this.summary = partial.summary;
    this.metadata = partial.metadata;
    this.ipAddress = partial.ipAddress;
    this.createdAt = partial.createdAt;
  }
}

export class PaginatedAuditLogsEntity {
  @ApiProperty({ type: () => AuditLogEntity, isArray: true })
  items: AuditLogEntity[];

  @ApiProperty({ example: { page: 1, limit: 30, total: 120, totalPages: 4 } })
  meta: { page: number; limit: number; total: number; totalPages: number };

  constructor(partial: PaginatedAuditLogsEntity) {
    this.items = partial.items;
    this.meta = partial.meta;
  }
}
