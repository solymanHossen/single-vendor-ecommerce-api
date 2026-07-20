import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserProfileEntity } from './entities/user-profile.entity';

const USER_PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  avatarUrl: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type UserProfileRow = Prisma.UserGetPayload<{ select: typeof USER_PROFILE_SELECT }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: number): Promise<UserProfileEntity> {
    // JwtStrategy already resolved this id to an active, non-deleted user
    // before the request reached this handler, so a plain lookup by id
    // (no deletedAt/isActive re-check) is safe here.
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: USER_PROFILE_SELECT,
    });

    return this.toEntity(user);
  }

  async updateProfile(userId: number, dto: UpdateProfileDto): Promise<UserProfileEntity> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: USER_PROFILE_SELECT,
    });

    return this.toEntity(user);
  }

  private toEntity(user: UserProfileRow): UserProfileEntity {
    return new UserProfileEntity({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }
}
