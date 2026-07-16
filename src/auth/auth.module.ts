import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { SettingsModule } from '../settings/settings.module';

function parseExpiryToSeconds(str: string): number {
  const units: Record<string, number> = { s: 1, m: 60, h: 3_600, d: 86_400 };
  const unit = str.slice(-1);
  const value = parseInt(str.slice(0, -1), 10);
  return value * (units[unit] ?? 0);
}

@Module({
  imports: [
    SettingsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: parseExpiryToSeconds(
            configService.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN'),
          ),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
