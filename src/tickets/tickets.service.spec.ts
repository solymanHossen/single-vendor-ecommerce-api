import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../database/prisma.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockPrisma = {
  order: { findFirst: jest.fn() },
  ticket: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  ticketMessage: { create: jest.fn() },
  $transaction: jest.fn(),
};

const sampleRow = {
  id: 1,
  userId: 7,
  orderId: null,
  subject: 'Order not received',
  status: 'OPEN' as const,
  priority: 'MEDIUM' as const,
  messages: [
    {
      id: 1,
      message: 'Where is my order?',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      sender: { id: 7, name: 'Jane Doe' },
    },
  ],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const regularUser: AuthUser = { id: 7, email: 'a@b.com', role: Role.USER, isActive: true };
const adminUser: AuthUser = { id: 99, email: 'admin@b.com', role: Role.ADMIN, isActive: true };

describe('TicketsService', () => {
  let service: TicketsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('creates a ticket with its first message', async () => {
      mockPrisma.ticket.create.mockResolvedValueOnce(sampleRow);

      const result = await service.create(7, {
        subject: 'Order not received',
        priority: 'MEDIUM',
        message: 'Where is my order?',
      });

      expect(mockPrisma.ticket.create).toHaveBeenCalledWith({
        data: {
          userId: 7,
          orderId: undefined,
          subject: 'Order not received',
          priority: 'MEDIUM',
          messages: { create: [{ senderId: 7, message: 'Where is my order?' }] },
        },
        select: expect.any(Object),
      });
      expect(result.messages[0]?.sender.name).toBe('Jane Doe');
    });

    it('throws NotFoundException when orderId does not belong to the user', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.create(7, {
          subject: 'Order not received',
          priority: 'MEDIUM',
          orderId: 999,
          message: 'Where is my order?',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.ticket.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll()', () => {
    it('forces the where clause to the caller for a plain USER', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[sampleRow], 1]);

      await service.findAll(regularUser, { page: 1, limit: 20, sortOrder: 'desc', userId: 999 });

      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 7 } }),
      );
    });

    it('honors query.userId for ADMIN/SUPER_ADMIN callers', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[], 0]);

      await service.findAll(adminUser, { page: 1, limit: 20, sortOrder: 'desc', userId: 42 });

      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 42 } }),
      );
    });
  });

  describe('findOne()', () => {
    it('scopes the lookup to the caller for a plain USER', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValueOnce(sampleRow);

      await service.findOne(regularUser, 1);

      expect(mockPrisma.ticket.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1, userId: 7 } }),
      );
    });

    it('throws NotFoundException when not found or not owned', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValueOnce(null);

      await expect(service.findOne(regularUser, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('addMessage()', () => {
    it('appends a message when the caller owns the ticket', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValueOnce({ id: 1 });
      mockPrisma.ticket.findUniqueOrThrow.mockResolvedValueOnce(sampleRow);

      await service.addMessage(regularUser, 1, { message: 'Any update?' });

      expect(mockPrisma.ticketMessage.create).toHaveBeenCalledWith({
        data: { ticketId: 1, senderId: 7, message: 'Any update?' },
        select: { id: true },
      });
    });

    it('allows staff to reply on any ticket', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValueOnce({ id: 1 });
      mockPrisma.ticket.findUniqueOrThrow.mockResolvedValueOnce(sampleRow);

      await service.addMessage(adminUser, 1, { message: 'We are looking into it.' });

      expect(mockPrisma.ticket.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } }),
      );
    });

    it('throws NotFoundException when the ticket is not found or not owned', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValueOnce(null);

      await expect(service.addMessage(regularUser, 999, { message: 'Hi' })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.ticketMessage.create).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus()', () => {
    it('updates the ticket status', async () => {
      mockPrisma.ticket.update.mockResolvedValueOnce({ ...sampleRow, status: 'CLOSED' });

      const result = await service.updateStatus(1, { status: 'CLOSED' });

      expect(mockPrisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'CLOSED' },
        select: expect.any(Object),
      });
      expect(result.status).toBe('CLOSED');
    });
  });
});
