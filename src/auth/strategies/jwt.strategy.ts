import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../database/prisma.service';
import { AuthUser, JwtAccessPayload } from '../interfaces/auth.interfaces';
import { effectivePermissions } from '../../access/permissions';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtAccessPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        deletedAt: true,
        staffRole: { select: { permissions: true } },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is inactive or does not exist');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      permissions: effectivePermissions(user.role, user.staffRole?.permissions),
    };
  }
}
