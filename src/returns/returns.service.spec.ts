import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { ReturnsService } from './returns.service';
import { PrismaService } from '../database/prisma.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockTx = {
  returnRequest: { update: jest.fn() },
  order: { update: jest.fn() },
};

const mockPrisma = {
  order: { findFirst: jest.fn() },
  returnRequest: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const sampleRow = {
  id: 1,
  orderId: 301,
  userId: 7,
  reason: 'The item arrived damaged and unusable.',
  status: 'PENDING' as const,
  adminNote: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const regularUser: AuthUser = { id: 7, email: 'a@b.com', role: Role.USER, isActive: true };
const adminUser: AuthUser = { id: 99, email: 'admin@b.com', role: Role.ADMIN, isActive: true };

describe('ReturnsService', () => {
  let service: ReturnsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReturnsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ReturnsService>(ReturnsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (arg: unknown) =>
      typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(mockTx) : arg,
    );
  });

  describe('create()', () => {
    it('throws NotFoundException when the order does not belong to the user', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.create(7, { orderId: 999, reason: 'Damaged item on arrival.' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.returnRequest.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the order is not delivered', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce({ status: 'PENDING' });

      await expect(
        service.create(7, { orderId: 301, reason: 'Damaged item on arrival.' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates the return request for a delivered order', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce({ status: 'DELIVERED' });
      mockPrisma.returnRequest.create.mockResolvedValueOnce(sampleRow);

      const result = await service.create(7, { orderId: 301, reason: 'Damaged item on arrival.' });

      expect(mockPrisma.returnRequest.create).toHaveBeenCalledWith({
        data: { orderId: 301, userId: 7, reason: 'Damaged item on arrival.' },
        select: expect.any(Object),
      });
      expect(result.orderId).toBe(301);
    });
  });

  describe('findAll()', () => {
    it('forces the where clause to the caller for a plain USER', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[sampleRow], 1]);

      await service.findAll(regularUser, { page: 1, limit: 20, sortOrder: 'desc', userId: 999 });

      expect(mockPrisma.returnRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 7 } }),
      );
    });

    it('honors query.userId for ADMIN/SUPER_ADMIN callers', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[], 0]);

      await service.findAll(adminUser, { page: 1, limit: 20, sortOrder: 'desc', userId: 42 });

      expect(mockPrisma.returnRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 42 } }),
      );
    });
  });

  describe('findOne()', () => {
    it('scopes the lookup to the caller for a plain USER', async () => {
      mockPrisma.returnRequest.findFirst.mockResolvedValueOnce(sampleRow);

      await service.findOne(regularUser, 1);

      expect(mockPrisma.returnRequest.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1, userId: 7 } }),
      );
    });

    it('throws NotFoundException when not found or not owned', async () => {
      mockPrisma.returnRequest.findFirst.mockResolvedValueOnce(null);

      await expect(service.findOne(regularUser, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus()', () => {
    it('updates the status alone for non-REFUNDED transitions', async () => {
      mockPrisma.returnRequest.update.mockResolvedValueOnce({ ...sampleRow, status: 'APPROVED' });

      const result = await service.updateStatus(1, { status: 'APPROVED' });

      expect(mockPrisma.returnRequest.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'APPROVED', adminNote: undefined },
        select: expect.any(Object),
      });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(result.status).toBe('APPROVED');
    });

    it('syncs the order to RETURNED/REFUNDED in a transaction when marking REFUNDED', async () => {
      mockTx.returnRequest.update.mockResolvedValueOnce({ ...sampleRow, status: 'REFUNDED' });

      const result = await service.updateStatus(1, { status: 'REFUNDED', adminNote: 'Refunded.' });

      expect(mockTx.returnRequest.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'REFUNDED', adminNote: 'Refunded.' },
        select: expect.any(Object),
      });
      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 301 },
        data: { status: 'RETURNED', paymentStatus: 'REFUNDED' },
        select: { id: true },
      });
      expect(result.status).toBe('REFUNDED');
    });
  });
});
