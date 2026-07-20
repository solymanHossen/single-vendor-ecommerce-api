import { Test, type TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { PaginatedTicketsEntity, TicketEntity } from './entities/ticket.entity';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockTicketsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  addMessage: jest.fn(),
  updateStatus: jest.fn(),
};

const currentUser: AuthUser = { id: 7, email: 'a@b.com', role: Role.USER, isActive: true };

const sampleTicket = new TicketEntity({
  id: 1,
  userId: 7,
  orderId: null,
  subject: 'Order not received',
  status: 'OPEN',
  priority: 'MEDIUM',
  messages: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('TicketsController', () => {
  let controller: TicketsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [{ provide: TicketsService, useValue: mockTicketsService }],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it("delegates to the service with the current user's id and dto", async () => {
      mockTicketsService.create.mockResolvedValueOnce(sampleTicket);
      const dto = {
        subject: 'Order not received',
        priority: 'MEDIUM' as const,
        message: 'Where is my order?',
      };

      const result = await controller.create(currentUser, dto);

      expect(mockTicketsService.create).toHaveBeenCalledWith(7, dto);
      expect(result).toEqual({ message: 'Ticket created successfully', data: sampleTicket });
    });
  });

  describe('findAll()', () => {
    it('delegates to the service with the current user and query', async () => {
      const paginated = new PaginatedTicketsEntity({
        items: [sampleTicket],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
      mockTicketsService.findAll.mockResolvedValueOnce(paginated);
      const query = { page: 1, limit: 20, sortOrder: 'desc' as const };

      const result = await controller.findAll(currentUser, query);

      expect(mockTicketsService.findAll).toHaveBeenCalledWith(currentUser, query);
      expect(result).toEqual({ message: 'Tickets retrieved successfully', data: paginated });
    });
  });

  describe('findOne()', () => {
    it('delegates to the service with the current user and id', async () => {
      mockTicketsService.findOne.mockResolvedValueOnce(sampleTicket);

      const result = await controller.findOne(currentUser, 1);

      expect(mockTicketsService.findOne).toHaveBeenCalledWith(currentUser, 1);
      expect(result).toEqual({ message: 'Ticket retrieved successfully', data: sampleTicket });
    });
  });

  describe('addMessage()', () => {
    it('delegates to the service with the current user, id, and dto', async () => {
      mockTicketsService.addMessage.mockResolvedValueOnce(sampleTicket);

      const result = await controller.addMessage(currentUser, 1, { message: 'Any update?' });

      expect(mockTicketsService.addMessage).toHaveBeenCalledWith(currentUser, 1, {
        message: 'Any update?',
      });
      expect(result).toEqual({ message: 'Message added successfully', data: sampleTicket });
    });
  });

  describe('updateStatus()', () => {
    it('delegates to the service with id and dto', async () => {
      mockTicketsService.updateStatus.mockResolvedValueOnce({ ...sampleTicket, status: 'CLOSED' });

      const result = await controller.updateStatus(1, { status: 'CLOSED' });

      expect(mockTicketsService.updateStatus).toHaveBeenCalledWith(1, { status: 'CLOSED' });
      expect(result).toEqual({
        message: 'Ticket status updated successfully',
        data: { ...sampleTicket, status: 'CLOSED' },
      });
    });
  });
});
