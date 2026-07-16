import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { MailService } from '../mail/mail.service';
import { type RegisterDto } from './dto/register.dto';
import { type LoginDto } from './dto/login.dto';
import { type ForgotPasswordDto } from './dto/forgot-password.dto';
import { type ResetPasswordDto } from './dto/reset-password.dto';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$hashedpassword'),
  compare: jest.fn().mockResolvedValue(true),
}));

const mockSettingsService = {
  getSettings: jest.fn().mockResolvedValue({ allowRegistration: true, enableGoogleLogin: true }),
};

const mockMailService = {
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
};

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  passwordResetToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
};

const mockJwtService = {
  signAsync: jest.fn().mockResolvedValue('mock.access.token.signed'),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const configMap: Record<string, number | string> = {
      BCRYPT_ROUNDS: 10,
      MAX_FAILED_ATTEMPTS: 5,
      LOCK_DURATION_MINUTES: 15,
    };
    return configMap[key];
  }),
  getOrThrow: jest.fn((key: string) => {
    const configMap: Record<string, string> = {
      JWT_REFRESH_EXPIRES_IN: '7d',
      JWT_ACCESS_EXPIRES_IN: '15m',
    };
    const value = configMap[key];
    if (!value) throw new Error(`Config key not found: ${key}`);
    return value;
  }),
};

const baseUser = {
  id: 1,
  email: 'user@example.com',
  name: 'Test User',
  role: Role.USER,
  isActive: true,
  password: '$2b$12$hashedpassword',
  failedLoginAttempts: 0,
  lockedUntil: null,
  googleId: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    mockSettingsService.getSettings.mockResolvedValue({
      allowRegistration: true,
      enableGoogleLogin: true,
    });
    mockMailService.sendPasswordResetEmail.mockResolvedValue(undefined);

    // Restore default bcrypt mock after each clear
    (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$hashedpassword');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    mockJwtService.signAsync.mockResolvedValue('mock.access.token.signed');
    mockConfigService.get.mockImplementation((key: string) => {
      const configMap: Record<string, number | string> = {
        BCRYPT_ROUNDS: 10,
        MAX_FAILED_ATTEMPTS: 5,
        LOCK_DURATION_MINUTES: 15,
      };
      return configMap[key];
    });
    mockConfigService.getOrThrow.mockImplementation((key: string) => {
      const configMap: Record<string, string> = {
        JWT_REFRESH_EXPIRES_IN: '7d',
        JWT_ACCESS_EXPIRES_IN: '15m',
      };
      const value = configMap[key];
      if (!value) throw new Error(`Config key not found: ${key}`);
      return value;
    });
    mockPrisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
  });

  describe('register()', () => {
    const dto: RegisterDto = {
      email: 'New@Example.com',
      password: 'SecurePass123',
      name: 'New User',
    };

    it('should create a user and return SafeUser when registration is allowed', async () => {
      mockSettingsService.getSettings.mockResolvedValueOnce({
        allowRegistration: true,
        enableGoogleLogin: true,
      });
      mockPrisma.user.create.mockResolvedValueOnce({
        id: 2,
        email: 'new@example.com',
        name: 'New User',
        role: Role.USER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.register(dto);

      expect(mockSettingsService.getSettings).toHaveBeenCalledTimes(1);
      expect(bcrypt.hash).toHaveBeenCalledWith('SecurePass123', 10);
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'new@example.com' }),
        }),
      );
      expect(result.message).toBe('Registration successful');
      expect(result.data).not.toHaveProperty('password');
    });

    it('should throw ForbiddenException when allowRegistration is false', async () => {
      mockSettingsService.getSettings.mockResolvedValueOnce({
        allowRegistration: false,
        enableGoogleLogin: true,
      });

      await expect(service.register(dto)).rejects.toThrow(
        new ForbiddenException('Registration is currently disabled'),
      );
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should normalise email to lowercase before creating', async () => {
      mockSettingsService.getSettings.mockResolvedValueOnce({
        allowRegistration: true,
        enableGoogleLogin: true,
      });
      mockPrisma.user.create.mockResolvedValueOnce({
        id: 3,
        email: 'new@example.com',
        name: 'New User',
        role: Role.USER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.register(dto);

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'new@example.com' }),
        }),
      );
    });
  });

  describe('login()', () => {
    const dto: LoginDto = { email: 'user@example.com', password: 'SecurePass123' };

    it('should return tokens and safe user on successful login', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(baseUser);
      mockPrisma.user.update.mockResolvedValueOnce({});
      mockPrisma.refreshToken.create.mockResolvedValueOnce({ id: 1 });

      const result = await service.login(dto, 'Mozilla/5.0');

      expect(result.message).toBe('Login successful');
      expect(result.tokens.accessToken).toBe('mock.access.token.signed');
      expect(result.tokens.refreshToken).toBeDefined();
      expect(result.data).not.toHaveProperty('password');
      expect(result.data).not.toHaveProperty('failedLoginAttempts');
      expect(result.data).not.toHaveProperty('lockedUntil');
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException and perform dummy hash when email not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      await expect(service.login(dto, 'agent')).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
      // Timing safety: dummy hash must still run
      expect(bcrypt.hash).toHaveBeenCalledWith('timing_safe_dummy_comparison_value', 10);
    });

    it('should throw UnauthorizedException when password is invalid and atomically increment failedLoginAttempts', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
      mockPrisma.user.findFirst.mockResolvedValueOnce({ ...baseUser, failedLoginAttempts: 2 });
      mockPrisma.user.update.mockResolvedValueOnce({ failedLoginAttempts: 3 });

      await expect(service.login(dto, 'agent')).rejects.toThrow(UnauthorizedException);

      // Atomic `increment`, not a read-then-write of a previously-fetched
      // count — closes the lost-update race under concurrent attempts.
      expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { failedLoginAttempts: { increment: 1 } },
        select: { failedLoginAttempts: true },
      });
    });

    it('should set lockedUntil in a follow-up update once the atomic increment reaches the threshold', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        ...baseUser,
        failedLoginAttempts: 4, // 5th attempt triggers lock
      });
      mockPrisma.user.update
        .mockResolvedValueOnce({ failedLoginAttempts: 5 })
        .mockResolvedValueOnce({});

      await expect(service.login(dto, 'agent')).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.update).toHaveBeenNthCalledWith(1, {
        where: { id: 1 },
        data: { failedLoginAttempts: { increment: 1 } },
        select: { failedLoginAttempts: true },
      });
      expect(mockPrisma.user.update).toHaveBeenNthCalledWith(2, {
        where: { id: 1 },
        data: { lockedUntil: expect.any(Date) },
        select: { id: true },
      });
    });

    it('should throw a generic UnauthorizedException before the password check when account is locked', async () => {
      const futureDate = new Date(Date.now() + 10 * 60_000);
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        ...baseUser,
        lockedUntil: futureDate,
      });

      // Deliberately the same message as an invalid password — a distinct
      // "this account is locked" message would leak account existence + lock
      // state to a prober.
      await expect(service.login(dto, 'agent')).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when account is inactive', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({ ...baseUser, isActive: false });

      await expect(service.login(dto, 'agent')).rejects.toThrow(
        new UnauthorizedException('Account is deactivated'),
      );
    });
  });

  describe('refresh()', () => {
    const futureDate = new Date(Date.now() + 7 * 86_400_000);

    const validStoredToken = {
      id: 10,
      userId: 1,
      revokedAt: null,
      expiresAt: futureDate,
    };

    it('should rotate token and return new accessToken on valid request', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValueOnce(validStoredToken);
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: 1,
        email: 'user@example.com',
        role: Role.USER,
      });
      mockPrisma.refreshToken.update.mockResolvedValueOnce({});
      mockPrisma.refreshToken.create.mockResolvedValueOnce({ id: 11 });

      const result = await service.refresh('valid-raw-token-64hex', 'Chrome/120');

      expect(result.tokens.accessToken).toBe('mock.access.token.signed');
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException when token hash is not found', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValueOnce(null);

      await expect(service.refresh('nonexistent-token', 'agent')).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
      expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('should revoke ALL user sessions and throw on token reuse (RTR theft detection)', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValueOnce({
        ...validStoredToken,
        revokedAt: new Date('2026-01-01'), // already revoked — replay attack
      });
      mockPrisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 3 });

      await expect(service.refresh('replayed-token', 'agent')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 1, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should throw UnauthorizedException and revoke when token is expired', async () => {
      const pastDate = new Date(Date.now() - 1_000);
      mockPrisma.refreshToken.findUnique.mockResolvedValueOnce({
        ...validStoredToken,
        expiresAt: pastDate,
      });
      mockPrisma.refreshToken.update.mockResolvedValueOnce({});

      await expect(service.refresh('expired-token', 'agent')).rejects.toThrow(
        new UnauthorizedException('Refresh token has expired'),
      );

      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { revokedAt: expect.any(Date) },
        select: { id: true },
      });
    });
  });

  describe('logout()', () => {
    it('should revoke the matching refresh token by hash', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 1 });

      const result = await service.logout('some-raw-token');

      expect(result.message).toBe('Logged out successfully');
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ revokedAt: null }),
          data: { revokedAt: expect.any(Date) },
        }),
      );
    });
  });

  describe('logoutAll()', () => {
    it('should revoke all active sessions for the given userId', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 4 });

      const result = await service.logoutAll(1);

      expect(result.message).toBe('All sessions revoked successfully');
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 1, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('googleLogin()', () => {
    const googleProfile = {
      googleId: 'google-uid-123',
      email: 'oauth@Gmail.com',
      name: 'OAuth User',
      accessToken: 'google-access-token',
    };

    it('should create a new user when no matching record exists', async () => {
      mockSettingsService.getSettings.mockResolvedValueOnce({
        allowRegistration: true,
        enableGoogleLogin: true,
      });
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.create.mockResolvedValueOnce({
        id: 5,
        email: 'oauth@gmail.com',
        name: 'OAuth User',
        role: Role.USER,
        isActive: true,
        googleId: 'google-uid-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.refreshToken.create.mockResolvedValueOnce({ id: 20 });

      const result = await service.googleLogin(googleProfile, 'Chrome');

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'oauth@gmail.com',
            googleId: 'google-uid-123',
          }),
        }),
      );
      expect(result.data).not.toHaveProperty('googleId');
      expect(result.tokens.accessToken).toBe('mock.access.token.signed');
    });

    it('should link googleId when existing user found by email without googleId', async () => {
      mockSettingsService.getSettings.mockResolvedValueOnce({
        allowRegistration: true,
        enableGoogleLogin: true,
      });
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        ...baseUser,
        googleId: null,
      });
      mockPrisma.user.update.mockResolvedValueOnce({});
      mockPrisma.refreshToken.create.mockResolvedValueOnce({ id: 21 });

      await service.googleLogin(googleProfile, 'Chrome');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { googleId: 'google-uid-123' },
        select: { id: true },
      });
    });

    it('should throw ForbiddenException when enableGoogleLogin is false', async () => {
      mockSettingsService.getSettings.mockResolvedValueOnce({
        allowRegistration: true,
        enableGoogleLogin: false,
      });

      await expect(service.googleLogin(googleProfile, 'Chrome')).rejects.toThrow(
        new ForbiddenException('Google login is currently disabled'),
      );
    });

    it('should throw UnauthorizedException when matched user is inactive', async () => {
      mockSettingsService.getSettings.mockResolvedValueOnce({
        allowRegistration: true,
        enableGoogleLogin: true,
      });
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        ...baseUser,
        isActive: false,
        googleId: 'google-uid-123',
      });

      await expect(service.googleLogin(googleProfile, 'Chrome')).rejects.toThrow(
        new UnauthorizedException('Account is deactivated'),
      );
    });
  });

  describe('forgotPassword()', () => {
    const dto: ForgotPasswordDto = { email: 'User@Example.com' };

    it('creates a reset token and emails the link when the user exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 1, email: 'user@example.com' });
      mockPrisma.passwordResetToken.create.mockResolvedValueOnce({ id: 1 });

      const result = await service.forgotPassword(dto);

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'user@example.com', deletedAt: null, isActive: true },
        select: { id: true, email: true },
      });
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 1, expiresAt: expect.any(Date) }),
        }),
      );
      expect(mockMailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.stringContaining('/reset-password?token='),
      );
      expect(result.message).toBe(
        'If an account with that email exists, a password reset link has been sent.',
      );
    });

    it('returns the same generic message without creating a token when no user matches', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      const result = await service.forgotPassword(dto);

      expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(mockMailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(result.message).toBe(
        'If an account with that email exists, a password reset link has been sent.',
      );
    });
  });

  describe('resetPassword()', () => {
    const dto: ResetPasswordDto = { token: 'raw-reset-token', password: 'NewSecurePass123' };

    const validStoredToken = {
      id: 5,
      userId: 1,
      expiresAt: new Date(Date.now() + 10 * 60_000),
      usedAt: null,
    };

    it('updates the password, marks the token used, and revokes all sessions', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValueOnce(validStoredToken);
      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 1 });
      mockPrisma.user.update.mockResolvedValueOnce({});
      mockPrisma.passwordResetToken.update.mockResolvedValueOnce({});
      mockPrisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 2 });

      const result = await service.resetPassword(dto);

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null, isActive: true },
        select: { id: true },
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('NewSecurePass123', 10);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          password: '$2b$12$hashedpassword',
          failedLoginAttempts: 0,
          lockedUntil: null,
        }),
        select: { id: true },
      });
      expect(mockPrisma.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { usedAt: expect.any(Date) },
        select: { id: true },
      });
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 1, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result.message).toBe('Password has been reset successfully');
    });

    it('throws UnauthorizedException when the token does not exist', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValueOnce(null);

      await expect(service.resetPassword(dto)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired password reset token'),
      );
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the token was already used', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValueOnce({
        ...validStoredToken,
        usedAt: new Date('2026-01-01'),
      });

      await expect(service.resetPassword(dto)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired password reset token'),
      );
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the token has expired', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValueOnce({
        ...validStoredToken,
        expiresAt: new Date(Date.now() - 1_000),
      });

      await expect(service.resetPassword(dto)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired password reset token'),
      );
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the user was soft-deleted or deactivated after the token was issued', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValueOnce(validStoredToken);
      // findFirst is scoped to deletedAt: null, isActive: true — a deleted/deactivated
      // user simply doesn't match and resolves to null, same as a real Prisma query.
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      await expect(service.resetPassword(dto)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired password reset token'),
      );
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });
});
