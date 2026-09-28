import { Test, type TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { AUDIT_PURGE_BATCH_SIZE } from './audit.constants';

const mockPrisma = {
  auditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  $transaction: jest.fn(),
  $executeRaw: jest.fn(),
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(90) } },
      ],
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
    expect(findArgs.where).toEqual({
      createdAt: { gte: expect.any(Date) },
      action: { startsWith: 'user.' },
    });
    expect(findArgs.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(findArgs.skip).toBe(30);
    expect(page.meta.totalPages).toBe(0);
    expect(page.retentionDays).toBe(90);
  });

  it('only reads entries inside the 90-day window', async () => {
    mockPrisma.$transaction.mockResolvedValueOnce([[], 0]);
    mockPrisma.auditLog.findMany.mockImplementation((args: unknown) => args);
    mockPrisma.auditLog.count.mockImplementation((args: unknown) => args);

    await service.findAll({ page: 1, limit: 30 });

    const [findArgs] = mockPrisma.$transaction.mock.calls[0][0] as [
      { where: { createdAt: { gte: Date } } },
    ];
    const ageDays = (Date.now() - findArgs.where.createdAt.gte.getTime()) / 86_400_000;
    expect(Math.round(ageDays)).toBe(90);
  });

  describe('purgeExpired()', () => {
    it('deletes in batches until a batch comes back short', async () => {
      mockPrisma.$executeRaw
        .mockResolvedValueOnce(AUDIT_PURGE_BATCH_SIZE)
        .mockResolvedValueOnce(AUDIT_PURGE_BATCH_SIZE)
        .mockResolvedValueOnce(12);

      await expect(service.purgeExpired()).resolves.toBe(2 * AUDIT_PURGE_BATCH_SIZE + 12);
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(3);
    });

    it('does one cheap query when nothing has expired', async () => {
      mockPrisma.$executeRaw.mockResolvedValueOnce(0);

      await expect(service.purgeExpired()).resolves.toBe(0);
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('cuts off exactly the retention period before now', () => {
      const now = new Date('2026-09-28T00:00:00.000Z');
      expect(service.retentionCutoff(now).toISOString()).toBe('2026-06-30T00:00:00.000Z');
    });
  });
});
