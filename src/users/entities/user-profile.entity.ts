import { ApiProperty } from '@nestjs/swagger';
import type { Role } from '@prisma/client';
import { ALL_PERMISSIONS, type Permission } from '../../access/permissions';

interface UserProfileEntityInput {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: Role;
  isActive: boolean;
  staffRole: { id: number; name: string } | null;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
}

export class UserProfileEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'jane.doe@example.com' })
  email: string;

  @ApiProperty({ nullable: true, example: 'Jane Doe' })
  name: string | null;

  @ApiProperty({ nullable: true, example: '+1 555-0100' })
  phone: string | null;

  @ApiProperty({ nullable: true, example: 'https://cdn.example.com/avatars/1.jpg' })
  avatarUrl: string | null;

  @ApiProperty({ example: 'USER' })
  role: Role;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ nullable: true, example: { id: 2, name: 'Order manager' } })
  staffRole: { id: number; name: string } | null;

  @ApiProperty({
    enum: ALL_PERMISSIONS,
    isArray: true,
    description:
      'What this account may do in the admin console (all for SUPER_ADMIN, none for USER)',
  })
  permissions: Permission[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: UserProfileEntityInput) {
    this.id = partial.id;
    this.email = partial.email;
    this.name = partial.name;
    this.phone = partial.phone;
    this.avatarUrl = partial.avatarUrl;
    this.role = partial.role;
    this.isActive = partial.isActive;
    this.staffRole = partial.staffRole;
    this.permissions = partial.permissions;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}
