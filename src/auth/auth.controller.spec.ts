import { Test, type TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { type Request, type Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { type RegisterDto } from './dto/register.dto';
import { type LoginDto } from './dto/login.dto';
import { type ForgotPasswordDto } from './dto/forgot-password.dto';
import { type ResetPasswordDto } from './dto/reset-password.dto';
import { type AuthUser, type SafeUser, type TokenPair } from './interfaces/auth.interfaces';

const mockSafeUser: SafeUser = {
  id: 1,
  email: 'user@example.com',
  name: 'Test User',
  role: Role.USER,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockTokenPair: TokenPair = {
  accessToken: 'mock.access.jwt',
  refreshToken: 'mock-opaque-refresh-token-64hex',
};

const mockAuthUser: AuthUser = {
  id: 1,
  email: 'user@example.com',
  role: Role.USER,
  isActive: true,
};

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  logoutAll: jest.fn(),
  googleLogin: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'NODE_ENV') return 'test';
    return undefined;
  }),
  getOrThrow: jest.fn((key: string) => {
    if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
    throw new Error(`Unknown key: ${key}`);
  }),
};

const buildMockRequest = (overrides: Partial<Request> = {}): Partial<Request> => ({
  cookies: {},
  headers: { 'user-agent': 'TestAgent/1.0' },
  ...overrides,
});

// Kept as a plain object (not typed `Partial<Response>`) so `cookie`/`clearCookie`
// stay function-typed properties rather than the "method" shape Express's Response
// interface declares — the latter trips @typescript-eslint/unbound-method on the
// `expect(res.cookie)`/`expect(res.clearCookie)` assertions below. Cast to Response
// only at the call site when passed into the controller.
const buildMockResponse = () => ({
  cookie: jest.fn(),
  clearCookie: jest.fn(),
});

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();

    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    });
    mockConfigService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
      throw new Error(`Unknown key: ${key}`);
    });
  });

  describe('register()', () => {
    it('should delegate to authService.register and return the result', async () => {
      const dto: RegisterDto = {
        email: 'new@example.com',
        password: 'SecurePass123',
        name: 'New User',
      };
      const expected = { message: 'Registration successful', data: mockSafeUser };
      mockAuthService.register.mockResolvedValueOnce(expected);

      const result = await controller.register(dto);

      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('login()', () => {
    it('should set httpOnly cookie and return accessToken + user (never refreshToken in body)', async () => {
      const dto: LoginDto = { email: 'user@example.com', password: 'SecurePass123' };
      const req = buildMockRequest() as Request;
      const res = buildMockResponse();

      mockAuthService.login.mockResolvedValueOnce({
        message: 'Login successful',
        data: mockSafeUser,
        tokens: mockTokenPair,
      });

      const result = await controller.login(dto, req, res as unknown as Response);

      expect(mockAuthService.login).toHaveBeenCalledWith(dto, 'TestAgent/1.0');
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        mockTokenPair.refreshToken,
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/api/v1/auth/refresh',
          maxAge: expect.any(Number),
        }),
      );
      expect(result.data.accessToken).toBe(mockTokenPair.accessToken);
      expect(result.data.user).toEqual(mockSafeUser);
      // Refresh token must NOT appear in the response body
      expect(JSON.stringify(result)).not.toContain(mockTokenPair.refreshToken);
    });
  });

  describe('forgotPassword()', () => {
    it('should delegate to authService.forgotPassword and return the result', async () => {
      const dto: ForgotPasswordDto = { email: 'user@example.com' };
      const expected = {
        message: 'If an account with that email exists, a password reset link has been sent.',
      };
      mockAuthService.forgotPassword.mockResolvedValueOnce(expected);

      const result = await controller.forgotPassword(dto);

      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('resetPassword()', () => {
    it('should delegate to authService.resetPassword and return the result', async () => {
      const dto: ResetPasswordDto = { token: 'raw-token', password: 'NewSecurePass123' };
      const expected = { message: 'Password has been reset successfully' };
      mockAuthService.resetPassword.mockResolvedValueOnce(expected);

      const result = await controller.resetPassword(dto);

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('refresh()', () => {
    it('should read refresh_token cookie, rotate tokens, and set a new cookie', async () => {
      const req = buildMockRequest({
        cookies: { refresh_token: 'existing-refresh-token' },
      }) as Request;
      const res = buildMockResponse();

      mockAuthService.refresh.mockResolvedValueOnce({
        message: 'Token refreshed successfully',
        tokens: { ...mockTokenPair, refreshToken: 'new-refresh-token' },
      });

      const result = await controller.refresh(req, res as unknown as Response);

      expect(mockAuthService.refresh).toHaveBeenCalledWith(
        'existing-refresh-token',
        'TestAgent/1.0',
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'new-refresh-token',
        expect.objectContaining({ httpOnly: true, path: '/api/v1/auth/refresh' }),
      );
      expect(result.data.accessToken).toBe(mockTokenPair.accessToken);
    });

    it('should throw UnauthorizedException when no refresh_token cookie is present', async () => {
      const req = buildMockRequest({ cookies: {} }) as Request;
      const res = buildMockResponse();

      await expect(controller.refresh(req, res as unknown as Response)).rejects.toThrow(
        new UnauthorizedException('No refresh token provided'),
      );
      expect(mockAuthService.refresh).not.toHaveBeenCalled();
    });
  });

  describe('logout()', () => {
    it('should revoke the token and clear the cookie', async () => {
      const req = buildMockRequest({
        cookies: { refresh_token: 'current-token' },
      }) as Request;
      const res = buildMockResponse();

      mockAuthService.logout.mockResolvedValueOnce({ message: 'Logged out successfully' });

      const result = await controller.logout(req, res as unknown as Response);

      expect(mockAuthService.logout).toHaveBeenCalledWith('current-token');
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/api/v1/auth/refresh',
      });
      expect(result.message).toBe('Logged out successfully');
    });

    it('should still clear cookie even when no refresh_token cookie is present', async () => {
      const req = buildMockRequest({ cookies: {} }) as Request;
      const res = buildMockResponse();

      const result = await controller.logout(req, res as unknown as Response);

      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/api/v1/auth/refresh',
      });
      expect(result.message).toBe('Logged out successfully');
    });
  });

  describe('logoutAll()', () => {
    it('should revoke all sessions for current user and clear cookie', async () => {
      const res = buildMockResponse();
      mockAuthService.logoutAll.mockResolvedValueOnce({
        message: 'All sessions revoked successfully',
      });

      const result = await controller.logoutAll(mockAuthUser, res as unknown as Response);

      expect(mockAuthService.logoutAll).toHaveBeenCalledWith(mockAuthUser.id);
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/api/v1/auth/refresh',
      });
      expect(result.message).toBe('All sessions revoked successfully');
    });
  });

  describe('getMe()', () => {
    it('should return the current authenticated user from context', () => {
      const result = controller.getMe(mockAuthUser);

      expect(result.message).toBe('Profile retrieved successfully');
      expect(result.data).toEqual(mockAuthUser);
    });
  });

  describe('googleCallback()', () => {
    it('should call authService.googleLogin with req.user, set cookie, return user + accessToken', async () => {
      const googleProfile = {
        googleId: 'google-uid-123',
        email: 'oauth@gmail.com',
        name: 'OAuth User',
        accessToken: 'google-access-token',
      };
      const req = {
        ...buildMockRequest(),
        user: googleProfile,
      } as Request & { user: typeof googleProfile };
      const res = buildMockResponse();

      mockAuthService.googleLogin.mockResolvedValueOnce({
        message: 'Google login successful',
        data: mockSafeUser,
        tokens: mockTokenPair,
      });

      const result = await controller.googleCallback(req, res as unknown as Response);

      expect(mockAuthService.googleLogin).toHaveBeenCalledWith(googleProfile, 'TestAgent/1.0');
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        mockTokenPair.refreshToken,
        expect.objectContaining({ httpOnly: true }),
      );
      expect(result.data.accessToken).toBe(mockTokenPair.accessToken);
      expect(result.data.user).toEqual(mockSafeUser);
    });
  });
});
