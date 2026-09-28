import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { AdminTicketsService } from './admin-tickets.service';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const actor: AuthUser = {
  id: 2,
  email: 'admin@example.com',
  role: Role.ADMIN,
  isActive: true,
  permissions: ['tickets.manage'],
};

const mockPrisma = {
  ticket: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    groupBy: jest.fn(),
  },
  ticketMessage: { create: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
  order: { count: jest.fn() },
  user: { findMany: jest.fn() },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
};
const mockMail = { sendTicketReplyEmail: jest.fn() };

describe('AdminTicketsService', () => {
  let service: AdminTicketsService;
  let findOne: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminTicketsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMail },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'APP_URL' ? 'https://shop.test/' : undefined),
          },
        },
      ],
    }).compile();
    service = module.get(AdminTicketsService);
    jest.resetAllMocks();
    mockPrisma.$transaction.mockImplementation((ops: unknown) =>
      Array.isArray(ops) ? Promise.resolve(ops) : Promise.resolve([]),
    );
    mockPrisma.ticketMessage.create.mockImplementation((args: unknown) => args);
    mockPrisma.ticket.update.mockImplementation((args: unknown) => args);
    mockPrisma.ticket.findMany.mockImplementation((args: unknown) => args);
    mockPrisma.ticket.count.mockImplementation((args: unknown) => args);
    mockMail.sendTicketReplyEmail.mockResolvedValue(undefined);
    findOne = jest.spyOn(service, 'findOne').mockResolvedValue({} as never);
  });

  describe('findAll()', () => {
    it('works the reply queue most urgent, longest waiting first', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[], 0]);

      await service.findAll(actor, { page: 1, limit: 25, view: 'needs_reply' });

      const [args] = mockPrisma.$transaction.mock.calls[0][0] as [
        { where: unknown; orderBy: unknown },
      ];
      expect(args.where).toEqual({ awaitingStaff: true });
      expect(args.orderBy).toEqual([{ priority: 'desc' }, { lastMessageAt: 'asc' }, { id: 'asc' }]);
    });

    it('finds a ticket by its number or the order number', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[], 0]);

      await service.findAll(actor, { page: 1, limit: 25, view: 'all', search: '#42' });

      const [args] = mockPrisma.$transaction.mock.calls[0][0] as [{ where: { OR: unknown[] } }];
      expect(args.where.OR).toEqual(expect.arrayContaining([{ id: 42 }, { orderId: 42 }]));
    });

    it('scopes "mine" to the viewer and open work', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([[], 0]);
      await service.findAll(actor, { page: 1, limit: 25, view: 'mine' });
      const [args] = mockPrisma.$transaction.mock.calls[0][0] as [{ where: unknown }];
      expect(args.where).toEqual({ assigneeId: 2, status: { notIn: ['RESOLVED', 'CLOSED'] } });
    });
  });

  describe('reply()', () => {
    const ticket = {
      id: 5,
      subject: 'Where is my order?',
      assigneeId: null,
      firstResponseAt: null,
      user: { email: 'c@example.com', name: 'Nusrat Jahan' },
    };

    it('replies, takes the unassigned ticket, starts the clock and emails the customer', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValueOnce(ticket);

      await service.reply(actor, 5, {
        message: 'It ships today.',
        attachments: [],
        internal: false,
      });

      const ops = mockPrisma.$transaction.mock.calls[0][0] as Array<{
        data: Record<string, unknown>;
      }>;
      expect(ops[0]?.data).toMatchObject({
        kind: 'EVENT',
        message: 'took this request',
        isInternal: true,
      });
      expect(ops[1]?.data).toMatchObject({ message: 'It ships today.', senderId: 2 });
      expect(ops[2]?.data).toMatchObject({
        status: 'WAITING',
        awaitingStaff: false,
        assigneeId: 2,
        firstResponseAt: expect.any(Date),
      });
      expect(mockMail.sendTicketReplyEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'c@example.com',
          url: 'https://shop.test/dashboard/support/5',
        }),
      );
      expect(findOne).toHaveBeenCalledWith(5);
    });

    it('can reply and resolve in one go', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValueOnce({
        ...ticket,
        assigneeId: 2,
        firstResponseAt: new Date(),
      });

      await service.reply(actor, 5, {
        message: 'Done!',
        attachments: [],
        internal: false,
        status: 'RESOLVED',
      });

      const ops = mockPrisma.$transaction.mock.calls[0][0] as Array<{
        data: Record<string, unknown>;
      }>;
      expect(ops.map((op) => op.data.message ?? op.data.status)).toEqual([
        'Done!',
        'marked this as resolved',
        'RESOLVED',
      ]);
    });

    it('keeps notes internal: no status change, no email', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValueOnce(ticket);

      await service.reply(actor, 5, { message: 'VIP customer', attachments: [], internal: true });

      expect(mockPrisma.ticketMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ kind: 'NOTE', isInternal: true }),
        }),
      );
      expect(mockPrisma.ticket.update).not.toHaveBeenCalled();
      expect(mockMail.sendTicketReplyEmail).not.toHaveBeenCalled();
    });

    it('never fails a saved reply because email is down', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValueOnce(ticket);
      mockMail.sendTicketReplyEmail.mockRejectedValueOnce(new Error('SMTP down'));

      await expect(
        service.reply(actor, 5, { message: 'Hi', attachments: [], internal: false }),
      ).resolves.toBeDefined();
    });
  });

  describe('update()', () => {
    const current = { status: 'OPEN', priority: 'MEDIUM', category: 'ORDER', assigneeId: null };

    it('records each change on the timeline', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValueOnce(current);

      await service.update(actor, 5, { status: 'RESOLVED', priority: 'HIGH' });

      const ops = mockPrisma.$transaction.mock.calls[0][0] as Array<{
        data: Record<string, unknown>;
      }>;
      expect(ops[0]?.data).toMatchObject({ message: 'marked this as resolved', isInternal: false });
      expect(ops[1]?.data).toMatchObject({ message: 'set the priority to High', isInternal: true });
      expect(ops[2]?.data).toMatchObject({
        status: 'RESOLVED',
        awaitingStaff: false,
        priority: 'HIGH',
      });
    });

    it('does nothing when nothing changed', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValueOnce(current);
      await service.update(actor, 5, { status: 'OPEN' });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('only assigns staff who handle support', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValueOnce(current);
      mockPrisma.user.findMany.mockResolvedValueOnce([
        {
          id: 3,
          name: 'Catalog Editor',
          email: 'c@x',
          avatarUrl: null,
          role: 'ADMIN',
          staffRole: { permissions: ['catalog.manage'] },
        },
      ]);
      await expect(service.update(actor, 5, { assigneeId: 3 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  it('closes tickets resolved over a week ago with a system entry', async () => {
    mockPrisma.ticket.findMany.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
    mockPrisma.ticketMessage.createMany.mockImplementation((args: unknown) => args);
    mockPrisma.ticket.updateMany.mockImplementation(() => ({ count: 2 }));
    mockPrisma.$transaction.mockImplementationOnce((ops: unknown[]) => Promise.resolve(ops));

    await expect(service.closeStale(new Date('2026-09-28'))).resolves.toBe(2);

    const where = (
      mockPrisma.ticket.findMany.mock.calls[0][0] as { where: { resolvedAt: { lt: Date } } }
    ).where;
    expect(where.resolvedAt.lt.toISOString()).toBe('2026-09-21T00:00:00.000Z');
    const [events] = mockPrisma.$transaction.mock.calls[0][0] as [
      { data: Array<{ senderId: null }> },
    ];
    expect(events.data[0]?.senderId).toBeNull();
  });
});
