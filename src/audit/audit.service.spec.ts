import { Test, type TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../database/prisma.service';

const mockPrisma = {
  auditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  $transaction: jest.fn(),
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(AuditService);
    jest.resetAllMocks();
  });

  it('stores the actor email so history survives the account', async () => {
    mockPrisma.auditLog.create.mockResolvedValueOnce({ id: 1 });

    await service.record({
      actor: { id: 1, email: 'owner@example.com' },
      action: 'user.unlocked',
      targetType: 'user',
      targetId: 17,
      summary: 'Unlocked sign-in for rafi@example.com',
      ipAddress: '203.0.113.7',
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 1,
        actorEmail: 'owner@example.com',
        targetId: '17',
        ipAddress: '203.0.113.7',
      }),
      select: { id: true },
    });
  });

  it('never throws — a logging failure must not undo the action', async () => {
    mockPrisma.auditLog.create.mockRejectedValueOnce(new Error('db down'));

    await expect(
      service.record({
        actor: null,
        action: 'auth.account_locked',
        targetType: 'user',
        summary: 'x',
      }),
    ).resolves.toBeUndefined();
  });

  it('filters by area prefix and pages newest first', async () => {
    mockPrisma.$transaction.mockResolvedValueOnce([[], 0]);
    mockPrisma.auditLog.findMany.mockImplementation((args: unknown) => args);
    mockPrisma.auditLog.count.mockImplementation((args: unknown) => args);

    const page = await service.findAll({ page: 2, limit: 30, area: 'user' });

    const [findArgs] = mockPrisma.$transaction.mock.calls[0][0] as [
      { where: unknown; orderBy: unknown; skip: number },
    ];
    expect(findArgs.where).toEqual({ action: { startsWith: 'user.' } });
    expect(findArgs.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(findArgs.skip).toBe(30);
    expect(page.meta.totalPages).toBe(0);
  });
});
