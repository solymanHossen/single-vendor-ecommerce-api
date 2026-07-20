import { Test, type TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentEntity } from './entities/payment.entity';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockPaymentsService = {
  create: jest.fn(),
  findOne: jest.fn(),
  updateStatus: jest.fn(),
};

const currentUser: AuthUser = { id: 7, email: 'a@b.com', role: Role.USER, isActive: true };

const samplePayment = new PaymentEntity({
  id: 1,
  orderId: 301,
  provider: 'STRIPE',
  transactionId: null,
  amount: 1998 as unknown as PaymentEntity['amount'],
  status: 'UNPAID',
  createdAt: new Date(),
});

describe('PaymentsController', () => {
  let controller: PaymentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: mockPaymentsService }],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('delegates to the service and wraps the result', async () => {
      mockPaymentsService.create.mockResolvedValueOnce(samplePayment);
      const dto = { orderId: 301, provider: 'STRIPE' as const, amount: 1998 };

      const result = await controller.create(dto);

      expect(mockPaymentsService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ message: 'Payment recorded successfully', data: samplePayment });
    });
  });

  describe('findOne()', () => {
    it('delegates to the service with the current user and id', async () => {
      mockPaymentsService.findOne.mockResolvedValueOnce(samplePayment);

      const result = await controller.findOne(currentUser, 1);

      expect(mockPaymentsService.findOne).toHaveBeenCalledWith(currentUser, 1);
      expect(result).toEqual({ message: 'Payment retrieved successfully', data: samplePayment });
    });
  });

  describe('updateStatus()', () => {
    it('delegates to the service with id and dto', async () => {
      mockPaymentsService.updateStatus.mockResolvedValueOnce({ ...samplePayment, status: 'PAID' });

      const result = await controller.updateStatus(1, { status: 'PAID' });

      expect(mockPaymentsService.updateStatus).toHaveBeenCalledWith(1, { status: 'PAID' });
      expect(result).toEqual({
        message: 'Payment status updated successfully',
        data: { ...samplePayment, status: 'PAID' },
      });
    });
  });
});
