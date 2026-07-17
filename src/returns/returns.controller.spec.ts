import { Test, type TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';
import {
  PaginatedReturnRequestsEntity,
  ReturnRequestEntity,
} from './entities/return-request.entity';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockReturnsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  updateStatus: jest.fn(),
};

const currentUser: AuthUser = { id: 7, email: 'a@b.com', role: Role.USER, isActive: true };

const sampleReturn = new ReturnRequestEntity({
  id: 1,
  orderId: 301,
  userId: 7,
  reason: 'Damaged item on arrival.',
  status: 'PENDING',
  adminNote: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('ReturnsController', () => {
  let controller: ReturnsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReturnsController],
      providers: [{ provide: ReturnsService, useValue: mockReturnsService }],
    }).compile();

    controller = module.get<ReturnsController>(ReturnsController);
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it("delegates to the service with the current user's id and dto", async () => {
      mockReturnsService.create.mockResolvedValueOnce(sampleReturn);
      const dto = { orderId: 301, reason: 'Damaged item on arrival.' };

      const result = await controller.create(currentUser, dto);

      expect(mockReturnsService.create).toHaveBeenCalledWith(7, dto);
      expect(result).toEqual({
        message: 'Return request submitted successfully',
        data: sampleReturn,
      });
    });
  });

  describe('findAll()', () => {
    it('delegates to the service with the current user and query', async () => {
      const paginated = new PaginatedReturnRequestsEntity({
        items: [sampleReturn],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
      mockReturnsService.findAll.mockResolvedValueOnce(paginated);
      const query = { page: 1, limit: 20, sortOrder: 'desc' as const };

      const result = await controller.findAll(currentUser, query);

      expect(mockReturnsService.findAll).toHaveBeenCalledWith(currentUser, query);
      expect(result).toEqual({
        message: 'Return requests retrieved successfully',
        data: paginated,
      });
    });
  });

  describe('findOne()', () => {
    it('delegates to the service with the current user and id', async () => {
      mockReturnsService.findOne.mockResolvedValueOnce(sampleReturn);

      const result = await controller.findOne(currentUser, 1);

      expect(mockReturnsService.findOne).toHaveBeenCalledWith(currentUser, 1);
      expect(result).toEqual({
        message: 'Return request retrieved successfully',
        data: sampleReturn,
      });
    });
  });

  describe('updateStatus()', () => {
    it('delegates to the service with id and dto', async () => {
      mockReturnsService.updateStatus.mockResolvedValueOnce({
        ...sampleReturn,
        status: 'APPROVED',
      });

      const result = await controller.updateStatus(1, { status: 'APPROVED' });

      expect(mockReturnsService.updateStatus).toHaveBeenCalledWith(1, { status: 'APPROVED' });
      expect(result).toEqual({
        message: 'Return request status updated successfully',
        data: { ...sampleReturn, status: 'APPROVED' },
      });
    });
  });
});
