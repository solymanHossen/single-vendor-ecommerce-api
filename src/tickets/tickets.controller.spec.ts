import { Test, type TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockService = {
  create: jest.fn(),
  findAll: jest.fn(),
  unreadCount: jest.fn(),
  findOne: jest.fn(),
  addMessage: jest.fn(),
  resolve: jest.fn(),
  rate: jest.fn(),
};
const user: AuthUser = {
  id: 7,
  email: 'c@example.com',
  role: Role.USER,
  isActive: true,
  permissions: [],
};

describe('TicketsController', () => {
  let controller: TicketsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [{ provide: TicketsService, useValue: mockService }],
    }).compile();
    controller = module.get(TicketsController);
    jest.clearAllMocks();
  });

  it('creates for the current user', async () => {
    mockService.create.mockResolvedValueOnce({ id: 1 });
    const dto = {
      category: 'OTHER' as const,
      subject: 'Hi',
      message: 'Hello there team',
      attachments: [],
    };
    await expect(controller.create(user, dto)).resolves.toEqual({
      message: 'Request sent',
      data: { id: 1 },
    });
    expect(mockService.create).toHaveBeenCalledWith(user, dto);
  });

  it('wraps the unread count', async () => {
    mockService.unreadCount.mockResolvedValueOnce(3);
    await expect(controller.unreadCount(user)).resolves.toMatchObject({ data: { count: 3 } });
  });

  it('delegates replies, resolve and rating with the current user', async () => {
    mockService.addMessage.mockResolvedValue({});
    mockService.resolve.mockResolvedValue({});
    mockService.rate.mockResolvedValue({});
    await controller.addMessage(user, 4, { message: 'x', attachments: [] });
    await controller.resolve(user, 4);
    await controller.rate(user, 4, { satisfied: true });
    expect(mockService.addMessage).toHaveBeenCalledWith(user, 4, { message: 'x', attachments: [] });
    expect(mockService.resolve).toHaveBeenCalledWith(user, 4);
    expect(mockService.rate).toHaveBeenCalledWith(user, 4, { satisfied: true });
  });
});
