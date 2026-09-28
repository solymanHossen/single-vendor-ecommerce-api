import { ApiProperty } from '@nestjs/swagger';
import { ALL_PERMISSIONS, type Permission } from '../../access/permissions';

export class StaffRoleEntity {
  @ApiProperty({ example: 2 })
  id: number;

  @ApiProperty({ example: 'Order manager' })
  name: string;

  @ApiProperty({ example: 'Fulfils orders, handles returns and answers customers.' })
  description: string;

  @ApiProperty({ enum: ALL_PERMISSIONS, isArray: true })
  permissions: Permission[];

  @ApiProperty({ example: 3, description: 'Staff accounts using this role' })
  memberCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: StaffRoleEntity) {
    this.id = partial.id;
    this.name = partial.name;
    this.description = partial.description;
    this.permissions = partial.permissions;
    this.memberCount = partial.memberCount;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}

/** Response shape for Swagger only (plain objects are returned). */
class PermissionEntity {
  @ApiProperty({ example: 'orders.manage' })
  key!: string;

  @ApiProperty({ example: 'Fulfil orders' })
  label!: string;

  @ApiProperty({ example: 'Move orders through preparing, shipping and delivery, or cancel them.' })
  description!: string;
}

export class PermissionGroupEntity {
  @ApiProperty({ example: 'orders' })
  key!: string;

  @ApiProperty({ example: 'Orders' })
  label!: string;

  @ApiProperty({ type: () => PermissionEntity, isArray: true })
  permissions!: PermissionEntity[];
}
