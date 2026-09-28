import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import type { PrismaService } from '../../database/prisma.service';
import { JwtStrategy } from './jwt.strategy';
import type { JwtAccessPayload } from '../interfaces/auth.interfaces';
import { ALL_PERMISSIONS } from '../../access/permissions';

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

    expect(result).toEqual({
      id: 1,
      email: 'a@b.com',
      role: Role.USER,
      isActive: true,
      permissions: [],
    });
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: 1, deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        deletedAt: true,
        staffRole: { select: { permissions: true } },
      },
    });
  });

  it("resolves an admin's permissions from their staff role on every request", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 2,
      email: 'staff@b.com',
      role: Role.ADMIN,
      isActive: true,
      deletedAt: null,
      // A retired key in the database is dropped, not trusted.
      staffRole: { permissions: ['orders.view', 'orders.manage', 'legacy.thing'] },
    });

    const result = await strategy.validate(payload);

    expect(result.permissions).toEqual(['orders.view', 'orders.manage']);
  });

  it('gives an admin without a staff role no permissions', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 3,
      email: 'new@b.com',
      role: Role.ADMIN,
      isActive: true,
      deletedAt: null,
      staffRole: null,
    });

    expect((await strategy.validate(payload)).permissions).toEqual([]);
  });

  it('gives a super admin every permission', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 4,
      email: 'owner@b.com',
      role: Role.SUPER_ADMIN,
      isActive: true,
      deletedAt: null,
      staffRole: null,
    });

    expect((await strategy.validate(payload)).permissions).toEqual([...ALL_PERMISSIONS]);
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
