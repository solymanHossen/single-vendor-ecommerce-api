import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleProfile, JwtAccessPayload, SafeUser, TokenPair } from './interfaces/auth.interfaces';

@Injectable()
export class AuthService {
  private readonly bcryptRounds: number;
  private readonly maxFailedAttempts: number;
  private readonly lockDurationMs: number;
  private readonly refreshExpiresIn: string;
  private readonly passwordResetTtlMs: number;
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
    private readonly mailService: MailService,
  ) {
    this.bcryptRounds = this.configService.get<number>('BCRYPT_ROUNDS') ?? 12;
    this.maxFailedAttempts = this.configService.get<number>('MAX_FAILED_ATTEMPTS') ?? 5;
    this.lockDurationMs = (this.configService.get<number>('LOCK_DURATION_MINUTES') ?? 15) * 60_000;
    this.refreshExpiresIn = this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN');
    this.passwordResetTtlMs =
      (this.configService.get<number>('PASSWORD_RESET_TOKEN_EXPIRES_MINUTES') ?? 30) * 60_000;

    const port = this.configService.get<number>('PORT') ?? 3000;
    const configuredAppUrl = this.configService.get<string>('APP_URL');
    this.appUrl = (configuredAppUrl ?? `http://localhost:${port}`).replace(/\/+$/, '');
  }

  async register(dto: RegisterDto): Promise<{ message: string; data: SafeUser }> {
    const settings = await this.settingsService.getSettings();

    if (!settings.allowRegistration) {
      throw new ForbiddenException('Registration is currently disabled');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        name: dto.name ?? null,
        password: passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { message: 'Registration successful', data: user };
  }

  async login(
    dto: LoginDto,
    deviceInfo: string,
  ): Promise<{ message: string; data: SafeUser; tokens: TokenPair }> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        password: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      // Timing-safe: prevent email enumeration via response-time differences
      await bcrypt.hash('timing_safe_dummy_comparison_value', this.bcryptRounds);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      // Deliberately the same message/branch-shape as an invalid password
      // (see the `!passwordValid` branch below) — telling a caller "this
      // account exists and is locked" is an enumeration channel, same class
      // of leak this file already avoids in forgotPassword() below.
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password ?? '');

    if (!passwordValid) {
      await this.recordFailedAttempt(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
        select: { id: true },
      }),
      this.prisma.refreshToken.create({
        data: {
          tokenHash: this.hashToken(tokens.refreshToken),
          userId: user.id,
          deviceInfo: deviceInfo.substring(0, 512),
          expiresAt: this.parseExpiry(this.refreshExpiresIn),
        },
        select: { id: true },
      }),
    ]);

    const { password: _pw, failedLoginAttempts: _fa, lockedUntil: _lu, ...safeUser } = user;

    return { message: 'Login successful', data: safeUser, tokens };
  }

  async refresh(
    rawToken: string,
    deviceInfo: string,
  ): Promise<{ message: string; tokens: TokenPair }> {
    const tokenHash = this.hashToken(rawToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        revokedAt: true,
        expiresAt: true,
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.revokedAt !== null) {
      // RTR theft detection: previously rotated token replayed — revoke all user sessions
      await this.prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(
        'Token reuse detected. All sessions have been revoked for security.',
      );
    }

    if (storedToken.expiresAt < new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
        select: { id: true },
      });
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: storedToken.userId, deletedAt: null, isActive: true },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedException('User account is no longer valid');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
        select: { id: true },
      }),
      this.prisma.refreshToken.create({
        data: {
          tokenHash: this.hashToken(tokens.refreshToken),
          userId: user.id,
          deviceInfo: deviceInfo.substring(0, 512),
          expiresAt: this.parseExpiry(this.refreshExpiresIn),
        },
        select: { id: true },
      }),
    ]);

    return { message: 'Token refreshed successfully', tokens };
  }

  async logout(rawToken: string): Promise<{ message: string; data: null }> {
    const tokenHash = this.hashToken(rawToken);

    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Explicit `data: null` — see TransformInterceptor: without it, its
    // fallback would nest this whole { message } object inside itself as
    // `data`, duplicating the message in the response body.
    return { message: 'Logged out successfully', data: null };
  }

  async logoutAll(userId: number): Promise<{ message: string; data: null }> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'All sessions revoked successfully', data: null };
  }

  async googleLogin(
    profile: GoogleProfile,
    deviceInfo: string,
  ): Promise<{ message: string; data: SafeUser; tokens: TokenPair }> {
    const settings = await this.settingsService.getSettings();

    if (!settings.enableGoogleLogin) {
      throw new ForbiddenException('Google login is currently disabled');
    }

    let existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { googleId: profile.googleId },
          { email: profile.email.toLowerCase(), deletedAt: null },
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        googleId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!existingUser) {
      existingUser = await this.prisma.user.create({
        data: {
          email: profile.email.toLowerCase(),
          name: profile.name,
          googleId: profile.googleId,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          googleId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } else if (existingUser.googleId !== profile.googleId) {
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: { googleId: profile.googleId },
        select: { id: true },
      });
      existingUser = { ...existingUser, googleId: profile.googleId };
    }

    if (!existingUser.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const tokens = await this.generateTokens(
      existingUser.id,
      existingUser.email,
      existingUser.role,
    );

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(tokens.refreshToken),
        userId: existingUser.id,
        deviceInfo: deviceInfo.substring(0, 512),
        expiresAt: this.parseExpiry(this.refreshExpiresIn),
      },
      select: { id: true },
    });

    const { googleId: _gid, ...safeUser } = existingUser;

    return { message: 'Google login successful', data: safeUser, tokens };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string; data: null }> {
    // Identical response whether or not the email is registered — prevents
    // account enumeration via this endpoint. `data: null` is explicit (not
    // omitted) — see TransformInterceptor: an object with `message` but no
    // `data` key falls back to nesting the whole object inside itself as
    // `data`, duplicating the message in the response body.
    const genericResponse = {
      message: 'If an account with that email exists, a password reset link has been sent.',
      data: null,
    };

    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null, isActive: true },
      select: { id: true, email: true },
    });

    if (!user) {
      return genericResponse;
    }

    const rawToken = randomBytes(32).toString('hex');

    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash: this.hashToken(rawToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + this.passwordResetTtlMs),
      },
      select: { id: true },
    });

    // Points at a frontend route — this backend-only starter kit doesn't ship
    // a UI for it, so downstream consumers should adjust the path to their
    // own SPA's reset-password screen.
    const resetUrl = `${this.appUrl}/reset-password?token=${rawToken}`;
    await this.mailService.sendPasswordResetEmail(user.email, resetUrl);

    return genericResponse;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string; data: null }> {
    const tokenHash = this.hashToken(dto.token);

    const storedToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    if (!storedToken || storedToken.usedAt !== null || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired password reset token');
    }

    // Every other gate that issues/consumes credentials (login, refresh,
    // googleLogin, JwtStrategy) re-checks deletedAt/isActive against the
    // *current* user row rather than trusting a snapshot taken when the
    // token was issued. This did not: a token requested just before a
    // soft-delete/deactivation could still be used to set a password
    // afterward. Close that gap here too.
    const user = await this.prisma.user.findFirst({
      where: { id: storedToken.userId, deletedAt: null, isActive: true },
      select: { id: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired password reset token');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: storedToken.userId },
        data: { password: passwordHash, failedLoginAttempts: 0, lockedUntil: null },
        select: { id: true },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: storedToken.id },
        data: { usedAt: new Date() },
        select: { id: true },
      }),
      // Password changed — invalidate every existing session so a leaked/stolen
      // refresh token can no longer be used to stay signed in as this user.
      this.prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Password has been reset successfully', data: null };
  }

  private async recordFailedAttempt(userId: number): Promise<void> {
    // Atomic `increment` — not a read-then-write of a previously-fetched count — so
    // concurrent failed attempts against the same account (e.g. a parallel
    // brute-force burst) can't under-count via a lost-update race and slip
    // past the lockout threshold.
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });

    if (updated.failedLoginAttempts >= this.maxFailedAttempts) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lockedUntil: new Date(Date.now() + this.lockDurationMs) },
        select: { id: true },
      });
    }
  }

  private async generateTokens(userId: number, email: string, role: Role): Promise<TokenPair> {
    const payload: JwtAccessPayload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      Promise.resolve(randomBytes(32).toString('hex')),
    ]);

    return { accessToken, refreshToken };
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private parseExpiry(durationStr: string): Date {
    const unit = durationStr.slice(-1);
    const value = parseInt(durationStr.slice(0, -1), 10);
    const multiplierMap: Record<string, number> = {
      s: 1_000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    const ms = value * (multiplierMap[unit] ?? 0);
    return new Date(Date.now() + ms);
  }
}
