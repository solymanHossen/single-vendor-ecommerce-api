import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Prisma, Role } from '@prisma/client';
import { AdminUsersService } from './admin-users.service';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ALL_PERMISSIONS } from '../access/permissions';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockPrisma = {
  user: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn(), update: jest.fn() },
  refreshToken: { findMany: jest.fn(), updateMany: jest.fn() },
  order: { aggregate: jest.fn(), findFirst: jest.fn() },
  address: { count: jest.fn() },
  staffRole: { findUnique: jest.fn() },
  $transaction: jest.fn(),
};
const mockAudit = { record: jest.fn() };

const owner: AuthUser = {
  id: 1,
  email: 'owner@example.com',
  role: Role.SUPER_ADMIN,
  isActive: true,
  permissions: [...ALL_PERMISSIONS],
};
const manager: AuthUser = {
  id: 2,
  email: 'manager@example.com',
  role: Role.ADMIN,
  isActive: true,
  permissions: ['customers.view', 'customers.manage'],
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 17,
    name: 'Rafi Ahmed',
    email: 'rafi@example.com',
    phone: null,
    avatarUrl: null,
    role: Role.USER,
    isActive: true,
    lockedUntil: null,
    lastLoginAt: null,
    googleId: null,
    password: '$2b$hash',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    staffRole: null,
    _count: { orders: 3, refreshTokens: 2 },
    ...overrides,
  };
}

describe('AdminUsersService', () => {
  let service: AdminUsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(AdminUsersService);
    jest.resetAllMocks();

    // Batched transactions resolve in order; interactive ones are unused here.
    mockPrisma.$transaction.mockImplementation((ops: unknown) => Promise.all(ops as unknown[]));
    mockPrisma.user.findMany.mockResolvedValue([row()]);
    mockPrisma.user.count.mockResolvedValue(1);
    // findOne() pieces, after any action.
    mockPrisma.refreshToken.findMany.mockResolvedValue([]);
    mockPrisma.order.aggregate.mockResolvedValue({
      _sum: { totalAmount: new Prisma.Decimal(500) },
    });
    mockPrisma.order.findFirst.mockResolvedValue(null);
    mockPrisma.address.count.mockResolvedValue(1);
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });
  });

  describe('findAll()', () => {
    it('limits non-owners to customer accounts, whatever they ask for', async () => {
      await service.findAll(manager, {
        page: 1,
        limit: 20,
        type: 'staff',
        status: 'all',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      const where = (
        mockPrisma.user.findMany.mock.calls[0][0] as { where: Record<string, unknown> }
      ).where;
      expect(where.role).toBe(Role.USER);
    });

    it('lets the owner list staff', async () => {
      await service.findAll(owner, {
        page: 1,
        limit: 20,
        type: 'staff',
        status: 'locked',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      const where = (
        mockPrisma.user.findMany.mock.calls[0][0] as { where: Record<string, unknown> }
      ).where;
      expect(where.role).toEqual({ in: [Role.ADMIN, Role.SUPER_ADMIN] });
      expect(where.lockedUntil).toEqual({ gt: expect.any(Date) });
    });

    it('never exposes the password hash, only whether one exists', async () => {
      const page = await service.findAll(owner, {
        page: 1,
        limit: 20,
        type: 'all',
        status: 'all',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(page.items[0]).not.toHaveProperty('password');
      expect(page.items[0]?.hasPassword).toBe(true);
      expect(page.items[0]?.activeSessions).toBe(2);
    });
  });

  describe('findOne()', () => {
    it('hides staff accounts from non-owners (404, not 403)', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(row({ role: Role.ADMIN }));

      await expect(service.findOne(manager, 17)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('guardrails', () => {
    it("refuses to act on the caller's own account", async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(row({ id: 2 }));

      await expect(
        service.setStatus(2, { isActive: false }, { actor: manager }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses to act on a super admin, even for the owner', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(row({ role: Role.SUPER_ADMIN }));

      await expect(service.unlock(17, { actor: owner })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets only the owner act on staff accounts', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(row({ role: Role.ADMIN }));

      await expect(service.revokeSessions(17, { actor: manager })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('setStatus()', () => {
    it('deactivating signs the account out everywhere and is audited', async () => {
      mockPrisma.user.findFirst
        .mockResolvedValueOnce(row()) // target
        .mockResolvedValueOnce(row({ isActive: false })); // findOne afterwards

      const result = await service.setStatus(
        17,
        { isActive: false },
        { actor: manager, ip: '203.0.113.7' },
      );

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 17 },
        data: { isActive: false },
        select: { id: true },
      });
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 17, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.deactivated',
          targetId: 17,
          ipAddress: '203.0.113.7',
        }),
      );
      expect(result.isActive).toBe(false);
    });

    it('reactivating keeps sessions untouched', async () => {
      mockPrisma.user.findFirst
        .mockResolvedValueOnce(row({ isActive: false }))
        .mockResolvedValueOnce(row());

      await service.setStatus(17, { isActive: true }, { actor: manager });

      expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('setAccess()', () => {
    it('gives a customer a staff role and records who, what and when', async () => {
      mockPrisma.user.findFirst
        .mockResolvedValueOnce({
          id: 17,
          name: 'Rafi',
          email: 'rafi@example.com',
          role: Role.USER,
          staffRole: null,
        })
        .mockResolvedValueOnce(
          row({
            role: Role.ADMIN,
            staffRole: { id: 2, name: 'Order manager', permissions: ['orders.view'] },
          }),
        );
      mockPrisma.staffRole.findUnique.mockResolvedValueOnce({ id: 2, name: 'Order manager' });

      const result = await service.setAccess(
        17,
        { role: 'ADMIN', staffRoleId: 2 },
        { actor: owner },
      );

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 17 },
        data: { role: 'ADMIN', staffRoleId: 2 },
        select: { id: true },
      });
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.access_changed',
          summary: 'Gave Rafi (rafi@example.com) the “Order manager” role',
        }),
      );
      expect(result.permissions).toEqual(['orders.view']);
    });

    it('turning staff back into a customer clears the staff role', async () => {
      mockPrisma.user.findFirst
        .mockResolvedValueOnce({
          id: 17,
          name: null,
          email: 'rafi@example.com',
          role: Role.ADMIN,
          staffRole: { name: 'Order manager' },
        })
        .mockResolvedValueOnce(row());

      await service.setAccess(17, { role: 'USER', staffRoleId: null }, { actor: owner });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { role: 'USER', staffRoleId: null } }),
      );
    });

    it('rejects a staff role that no longer exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: 17,
        name: null,
        email: 'x@y.z',
        role: Role.USER,
        staffRole: null,
      });
      mockPrisma.staffRole.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.setAccess(17, { role: 'ADMIN', staffRoleId: 99 }, { actor: owner }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("can't be used on yourself", async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: 1,
        name: null,
        email: 'owner@example.com',
        role: Role.USER,
        staffRole: null,
      });

      await expect(
        service.setAccess(1, { role: 'USER', staffRoleId: null }, { actor: owner }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
