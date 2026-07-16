import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import type { PrismaService } from '../../database/prisma.service';
import { JwtStrategy } from './jwt.strategy';
import type { JwtAccessPayload } from '../interfaces/auth.interfaces';

function buildConfigService(): ConfigService {
  return { getOrThrow: jest.fn().mockReturnValue('a'.repeat(32)) } as unknown as ConfigService;
}

const mockFindFirst = jest.fn();

function buildPrismaService(): PrismaService {
  return { user: { findFirst: mockFindFirst } } as unknown as PrismaService;
}

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  const payload: JwtAccessPayload = { sub: 1, email: 'a@b.com', role: Role.USER };

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(buildConfigService(), buildPrismaService());
  });

  it('returns the safe user (without deletedAt) when the account is active', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 1,
      email: 'a@b.com',
      role: Role.USER,
      isActive: true,
      deletedAt: null,
    });

    const result = await strategy.validate(payload);

    expect(result).toEqual({ id: 1, email: 'a@b.com', role: Role.USER, isActive: true });
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: 1, deletedAt: null },
      select: { id: true, email: true, role: true, isActive: true, deletedAt: true },
    });
  });

  it('rejects when the user no longer exists', async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when the user has been deactivated', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 1,
      email: 'a@b.com',
      role: Role.USER,
      isActive: false,
      deletedAt: null,
    });

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });
});
