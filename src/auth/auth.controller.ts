import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterSchema, type RegisterDto } from './dto/register.dto';
import { LoginSchema, type LoginDto } from './dto/login.dto';
import { ForgotPasswordSchema, type ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordSchema, type ResetPasswordDto } from './dto/reset-password.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AUTH_THROTTLE_KEY } from '../common/constants/throttler.constants';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser, GoogleProfile, SafeUser } from './interfaces/auth.interfaces';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @Public()
  @Throttle({ [AUTH_THROTTLE_KEY]: { limit: 10, ttl: 900_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new local user account' })
  @ApiBody({ schema: z.toJSONSchema(RegisterSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: 201, description: 'Account created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 403, description: 'Registration is disabled' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto,
  ): Promise<{ message: string; data: SafeUser }> {
    return this.authService.register(dto);
  }

  @Post('login')
  @Public()
  @Throttle({ [AUTH_THROTTLE_KEY]: { limit: 10, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({
    schema: z.toJSONSchema(LoginSchema) as unknown as ApiBodySchema,
    examples: {
      superAdmin: {
        summary: 'Seeded super-admin (dev only)',
        description:
          'Matches the SUPER_ADMIN account created by `npm run prisma:seed` in development — never a real credential.',
        value: { email: 'superadmin@example.com', password: 'Password123' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful — refresh token set in httpOnly cookie',
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or account locked' })
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string; data: { accessToken: string; user: SafeUser } }> {
    const deviceInfo = this.extractDeviceInfo(req);
    const result = await this.authService.login(dto, deviceInfo);

    this.setRefreshTokenCookie(res, result.tokens.refreshToken);

    return {
      message: result.message,
      data: { accessToken: result.tokens.accessToken, user: result.data },
    };
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ [AUTH_THROTTLE_KEY]: { limit: 10, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset link by email' })
  @ApiBody({ schema: z.toJSONSchema(ForgotPasswordSchema) as unknown as ApiBodySchema })
  @ApiResponse({
    status: 200,
    description: 'Generic success response — sent whether or not the email is registered',
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async forgotPassword(
    @Body(new ZodValidationPipe(ForgotPasswordSchema)) dto: ForgotPasswordDto,
  ): Promise<{ message: string; data: null }> {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @Public()
  @Throttle({ [AUTH_THROTTLE_KEY]: { limit: 10, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using a token issued by forgot-password' })
  @ApiBody({ schema: z.toJSONSchema(ResetPasswordSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Invalid or expired reset token' })
  async resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordSchema)) dto: ResetPasswordDto,
  ): Promise<{ message: string; data: null }> {
    return this.authService.resetPassword(dto);
  }

  @Post('refresh')
  @Public()
  @Throttle({ [AUTH_THROTTLE_KEY]: { limit: 10, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('refresh_token')
  @ApiOperation({ summary: 'Rotate refresh token and obtain new access token' })
  @ApiResponse({ status: 200, description: 'Token rotated successfully' })
  @ApiResponse({ status: 401, description: 'Invalid, expired, or replayed refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string; data: { accessToken: string } }> {
    const rawToken = (req.cookies as Record<string, string | undefined>)['refresh_token'];
    if (!rawToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const deviceInfo = this.extractDeviceInfo(req);
    const result = await this.authService.refresh(rawToken, deviceInfo);

    this.setRefreshTokenCookie(res, result.tokens.refreshToken);

    return { message: result.message, data: { accessToken: result.tokens.accessToken } };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the current device session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string; data: null }> {
    const rawToken = (req.cookies as Record<string, string | undefined>)['refresh_token'];

    if (rawToken) {
      await this.authService.logout(rawToken);
    }

    this.clearRefreshTokenCookie(res);
    return { message: 'Logged out successfully', data: null };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all sessions across all devices' })
  @ApiResponse({ status: 200, description: 'All sessions revoked' })
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string; data: null }> {
    const result = await this.authService.logoutAll(user.id);
    this.clearRefreshTokenCookie(res);
    return result;
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the currently authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  getMe(@CurrentUser() user: AuthUser): { message: string; data: AuthUser } {
    return { message: 'Profile retrieved successfully', data: user };
  }

  @Get('google')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth2 login flow' })
  googleAuth(): void {
    // Passport redirects to Google — this handler body is never reached
  }

  @Get('google/callback')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth2 callback handler' })
  @ApiResponse({ status: 200, description: 'Google login successful' })
  @ApiResponse({ status: 403, description: 'Google login is disabled' })
  async googleCallback(
    @Req() req: Request & { user: GoogleProfile },
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string; data: { accessToken: string; user: SafeUser } }> {
    const deviceInfo = this.extractDeviceInfo(req);
    const result = await this.authService.googleLogin(req.user, deviceInfo);

    this.setRefreshTokenCookie(res, result.tokens.refreshToken);

    return {
      message: result.message,
      data: { accessToken: result.tokens.accessToken, user: result.data },
    };
  }

  private setRefreshTokenCookie(res: Response, token: string): void {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const maxAge = this.parseMaxAgeMs(
      this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
    );

    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/api/v1/auth/refresh',
      maxAge,
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
  }

  private extractDeviceInfo(req: Request): string {
    return req.headers['user-agent'] ?? 'unknown';
  }

  private parseMaxAgeMs(durationStr: string): number {
    const unit = durationStr.slice(-1);
    const value = parseInt(durationStr.slice(0, -1), 10);
    const multiplierMap: Record<string, number> = {
      s: 1_000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return value * (multiplierMap[unit] ?? 0);
  }
}
