import { ConflictException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { StaffRolesService } from './staff-roles.service';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ALL_PERMISSIONS } from '../access/permissions';
import { CreateStaffRoleSchema } from './dto/staff-role.dto';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockPrisma = {
  staffRole: {
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};
const mockAudit = { record: jest.fn() };
const owner: AuthUser = {
  id: 1,
  email: 'owner@example.com',
  role: Role.SUPER_ADMIN,
  isActive: true,
  permissions: [...ALL_PERMISSIONS],
};

const roleRow = (overrides: Record<string, unknown> = {}) => ({
  id: 2,
  name: 'Order manager',
  description: '',
  permissions: ['orders.view', 'orders.manage'],
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { users: 3 },
  ...overrides,
});

describe('StaffRolesService', () => {
  let service: StaffRolesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffRolesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(StaffRolesService);
    jest.resetAllMocks();
  });

  it('serves the permission catalogue grouped for the UI', () => {
    const groups = service.permissionCatalog();
    expect(groups.flatMap((group) => group.permissions.map((p) => p.key))).toEqual([
      ...ALL_PERMISSIONS,
    ]);
  });

  it('maps member counts and drops retired permission keys', async () => {
    mockPrisma.staffRole.findMany.mockResolvedValueOnce([
      roleRow({ permissions: ['orders.view', 'gone.key'] }),
    ]);

    const [role] = await service.findAll();

    expect(role?.permissions).toEqual(['orders.view']);
    expect(role?.memberCount).toBe(3);
  });

  it('audits exactly which permissions changed', async () => {
    mockPrisma.staffRole.findUniqueOrThrow.mockResolvedValueOnce({
      name: 'Order manager',
      permissions: ['orders.view', 'orders.manage'],
    });
    mockPrisma.staffRole.update.mockResolvedValueOnce(
      roleRow({ permissions: ['orders.view', 'returns.manage'] }),
    );

    await service.update(2, { permissions: ['orders.view', 'returns.manage'] }, { actor: owner });

    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'role.updated',
        metadata: { added: ['returns.manage'], removed: ['orders.manage'], members: 3 },
      }),
    );
  });

  it('refuses to delete a role that still has members', async () => {
    mockPrisma.staffRole.findUniqueOrThrow.mockResolvedValueOnce({
      name: 'Order manager',
      _count: { users: 3 },
    });

    await expect(service.remove(2, { actor: owner })).rejects.toBeInstanceOf(ConflictException);
    expect(mockPrisma.staffRole.delete).not.toHaveBeenCalled();
  });

  it('deletes an unused role and audits it', async () => {
    mockPrisma.staffRole.findUniqueOrThrow.mockResolvedValueOnce({
      name: 'Temp',
      _count: { users: 0 },
    });

    await service.remove(5, { actor: owner });

    expect(mockPrisma.staffRole.delete).toHaveBeenCalledWith({
      where: { id: 5 },
      select: { id: true },
    });
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'role.deleted' }),
    );
  });

  it('rejects unknown permission keys and dedupes the rest', () => {
    expect(
      CreateStaffRoleSchema.safeParse({
        name: 'X role',
        permissions: ['orders.view', 'root.everything'],
      }).success,
    ).toBe(false);
    const parsed = CreateStaffRoleSchema.parse({
      name: 'X role',
      permissions: ['orders.view', 'orders.view'],
    });
    expect(parsed.permissions).toEqual(['orders.view']);
  });
});
