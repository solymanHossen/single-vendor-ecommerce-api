import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../database/prisma.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const customer: AuthUser = {
  id: 7,
  email: 'c@example.com',
  role: Role.USER,
  isActive: true,
  permissions: [],
};

const person = { id: 7, name: 'Nusrat Jahan', email: 'c@example.com', avatarUrl: null };
const staff = { id: 2, name: 'Admin One', email: 'admin@example.com', avatarUrl: null };

const detailRow = (overrides: Record<string, unknown> = {}) => ({
  id: 5,
  userId: 7,
  subject: 'Where is my order?',
  category: 'DELIVERY',
  status: 'WAITING',
  priority: 'MEDIUM',
  orderId: null,
  awaitingStaff: false,
  lastMessageAt: new Date('2026-09-02'),
  lastStaffReplyAt: new Date('2026-09-02'),
  customerReadAt: new Date('2026-09-01'),
  createdAt: new Date('2026-09-01'),
  satisfied: null,
  firstResponseAt: new Date('2026-09-02'),
  resolvedAt: null,
  user: { ...person, createdAt: new Date('2025-01-01') },
  assignee: staff,
  order: null,
  messages: [{ message: 'On its way!', senderId: 2, createdAt: new Date('2026-09-02') }],
  _count: { messages: 2 },
  ...overrides,
});

const mockPrisma = {
  order: { findFirst: jest.fn() },
  ticket: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    fields: { customerReadAt: { name: 'customerReadAt' } },
  },
  ticketMessage: { create: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(),
};

describe('TicketsService (customer)', () => {
  let service: TicketsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(TicketsService);
    jest.resetAllMocks();
    mockPrisma.$transaction.mockImplementation((ops: unknown[]) => Promise.resolve(ops));
    mockPrisma.ticketMessage.findMany.mockResolvedValue([]);
    mockPrisma.ticketMessage.create.mockImplementation((args: unknown) => args);
    mockPrisma.ticket.update.mockImplementation((args: unknown) => args);
  });

  describe('create()', () => {
    it('opens a request in the staff queue with the category’s priority', async () => {
      mockPrisma.ticket.create.mockResolvedValueOnce({ id: 5 });
      mockPrisma.ticket.findFirst.mockResolvedValueOnce(detailRow({ status: 'OPEN' }));

      await service.create(customer, {
        category: 'PAYMENT',
        subject: 'Charged twice',
        message: 'I was charged twice for order 12.',
        attachments: [],
      });

      const args = mockPrisma.ticket.create.mock.calls[0][0] as { data: Record<string, unknown> };
      expect(args.data).toMatchObject({
        userId: 7,
        priority: 'HIGH',
        awaitingStaff: true,
        category: 'PAYMENT',
      });
    });

    it('refuses an order that is not the customer’s', async () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.create(customer, {
          category: 'ORDER',
          subject: 'Help',
          message: 'Something about my order',
          orderId: 99,
          attachments: [],
        }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.ticket.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll()', () => {
    it('only lists the customer’s own active requests and flags unread replies', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[detailRow()], 1]);
      mockPrisma.ticket.findMany.mockImplementation((args: unknown) => args);

      const page = await service.findAll(customer, { page: 1, limit: 20, state: 'active' });

      const [findArgs] = mockPrisma.$transaction.mock.calls[0][0] as [{ where: unknown }];
      expect(findArgs.where).toEqual({ userId: 7, status: { notIn: ['RESOLVED', 'CLOSED'] } });
      expect(page.items[0]?.unread).toBe(true);
      expect(page.items[0]?.preview).toMatchObject({ text: 'On its way!', fromStaff: true });
      // Customers never see staff email addresses.
      expect(page.items[0]?.assignee?.email).toBeNull();
      expect(page.items[0]?.customer).toBeNull();
    });
  });

  describe('findOne()', () => {
    it('marks replies read and hides internal entries', async () => {
      mockPrisma.ticket.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.ticket.findFirst.mockResolvedValueOnce(detailRow());

      await service.findOne(customer, 5);

      expect(mockPrisma.ticket.updateMany).toHaveBeenCalledWith({
        where: { id: 5, userId: 7 },
        data: { customerReadAt: expect.any(Date) },
      });
      expect(mockPrisma.ticketMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ticketId: 5, isInternal: false } }),
      );
    });

    it('404s for someone else’s request', async () => {
      mockPrisma.ticket.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(service.findOne(customer, 5)).rejects.toThrow(NotFoundException);
    });
  });

  describe('addMessage()', () => {
    it('puts a waiting request back in the queue', async () => {
      mockPrisma.ticket.findFirst
        .mockResolvedValueOnce({ id: 5, status: 'WAITING' })
        .mockResolvedValueOnce(detailRow({ status: 'OPEN' }));

      await service.addMessage(customer, 5, { message: 'Still not here', attachments: [] });

      const ops = mockPrisma.$transaction.mock.calls[0][0] as Array<{
        data: Record<string, unknown>;
      }>;
      expect(ops).toHaveLength(2);
      expect(ops[1]?.data).toMatchObject({ status: 'OPEN', awaitingStaff: true, resolvedAt: null });
    });

    it('reopens a resolved request with a timeline entry', async () => {
      mockPrisma.ticket.findFirst
        .mockResolvedValueOnce({ id: 5, status: 'RESOLVED' })
        .mockResolvedValueOnce(detailRow({ status: 'OPEN' }));

      await service.addMessage(customer, 5, {
        message: 'Actually, one more thing',
        attachments: [],
      });

      const ops = mockPrisma.$transaction.mock.calls[0][0] as Array<{
        data: Record<string, unknown>;
      }>;
      expect(ops[0]?.data).toMatchObject({ kind: 'EVENT', message: 'reopened this request' });
      expect(ops[2]?.data).toMatchObject({ status: 'OPEN' });
    });

    it('refuses a closed request', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValueOnce({ id: 5, status: 'CLOSED' });
      await expect(
        service.addMessage(customer, 5, { message: 'Hello?', attachments: [] }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('resolve() / rate()', () => {
    it('resolves and leaves the queue', async () => {
      mockPrisma.ticket.findFirst
        .mockResolvedValueOnce({ id: 5, status: 'WAITING' })
        .mockResolvedValueOnce(detailRow({ status: 'RESOLVED' }));

      await service.resolve(customer, 5);

      const ops = mockPrisma.$transaction.mock.calls[0][0] as Array<{
        data: Record<string, unknown>;
      }>;
      expect(ops[1]?.data).toMatchObject({ status: 'RESOLVED', awaitingStaff: false });
    });

    it('only accepts a rating once resolved', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValueOnce({ id: 5, status: 'OPEN' });
      await expect(service.rate(customer, 5, { satisfied: true })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  it('counts unread replies with a column comparison', async () => {
    mockPrisma.ticket.count.mockResolvedValueOnce(2);
    await expect(service.unreadCount(7)).resolves.toBe(2);
    expect(mockPrisma.ticket.count).toHaveBeenCalledWith({
      where: {
        userId: 7,
        lastStaffReplyAt: { not: null },
        OR: [
          { customerReadAt: null },
          { lastStaffReplyAt: { gt: mockPrisma.ticket.fields.customerReadAt } },
        ],
      },
    });
  });
});
