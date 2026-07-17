import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Prisma, Role } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../database/prisma.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockTx = {
  payment: { update: jest.fn() },
  order: { update: jest.fn() },
};

const mockPrisma = {
  payment: {
    create: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

const sampleRow = {
  id: 1,
  orderId: 301,
  provider: 'STRIPE' as const,
  transactionId: null,
  amount: new Prisma.Decimal(1998),
  status: 'UNPAID' as const,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const regularUser: AuthUser = { id: 7, email: 'a@b.com', role: Role.USER, isActive: true };
const adminUser: AuthUser = { id: 99, email: 'admin@b.com', role: Role.ADMIN, isActive: true };

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (arg: unknown) =>
      typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(mockTx) : arg,
    );
  });

  describe('create()', () => {
    it('creates a payment record for the order', async () => {
      mockPrisma.payment.create.mockResolvedValueOnce(sampleRow);

      const dto = { orderId: 301, provider: 'STRIPE' as const, amount: 1998 };
      const result = await service.create(dto);

      expect(mockPrisma.payment.create).toHaveBeenCalledWith({
        data: dto,
        select: expect.any(Object),
      });
      expect(result.orderId).toBe(301);
    });
  });

  describe('findOne()', () => {
    it("scopes the lookup to the order's owner for a plain USER", async () => {
      mockPrisma.payment.findFirst.mockResolvedValueOnce(sampleRow);

      await service.findOne(regularUser, 1);

      expect(mockPrisma.payment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1, order: { userId: 7 } } }),
      );
    });

    it('allows ADMIN/SUPER_ADMIN to fetch any payment', async () => {
      mockPrisma.payment.findFirst.mockResolvedValueOnce(sampleRow);

      await service.findOne(adminUser, 1);

      expect(mockPrisma.payment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } }),
      );
    });

    it('throws NotFoundException when the payment does not exist or is not owned by the caller', async () => {
      mockPrisma.payment.findFirst.mockResolvedValueOnce(null);

      await expect(service.findOne(regularUser, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus()', () => {
    it("updates the payment and syncs the order's paymentStatus in one transaction", async () => {
      mockTx.payment.update.mockResolvedValueOnce({
        ...sampleRow,
        status: 'PAID',
        transactionId: 'ch_123',
      });

      const result = await service.updateStatus(1, { status: 'PAID', transactionId: 'ch_123' });

      expect(mockTx.payment.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'PAID', transactionId: 'ch_123' },
        select: expect.any(Object),
      });
      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 301 },
        data: { paymentStatus: 'PAID' },
        select: { id: true },
      });
      expect(result.status).toBe('PAID');
    });
  });
});
