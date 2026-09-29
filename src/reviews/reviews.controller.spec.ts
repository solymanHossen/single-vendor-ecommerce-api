import { Test, type TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockService = {
  findAllForProduct: jest.fn(),
  myStatus: jest.fn(),
  mine: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  toggleHelpful: jest.fn(),
};
const user: AuthUser = {
  id: 7,
  email: 'c@example.com',
  role: Role.USER,
  isActive: true,
  permissions: [],
};

describe('ReviewsController', () => {
  let controller: ReviewsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [{ provide: ReviewsService, useValue: mockService }],
    }).compile();
    controller = module.get(ReviewsController);
    jest.clearAllMocks();
  });

  it('lists a product’s reviews', async () => {
    mockService.findAllForProduct.mockResolvedValueOnce({ items: [] });
    const query = { page: 1, limit: 5, sort: 'recent' as const };
    await controller.findAllForProduct(3, query);
    expect(mockService.findAllForProduct).toHaveBeenCalledWith(3, query);
  });

  it('scopes author actions to the current user', async () => {
    mockService.create.mockResolvedValue({});
    mockService.update.mockResolvedValue({});
    mockService.toggleHelpful.mockResolvedValue({ helpful: true, helpfulCount: 1 });
    await controller.create(user, { productId: 3, rating: 5 });
    await controller.update(user, 1, { rating: 4 });
    await controller.remove(user, 1);
    await controller.toggleHelpful(user, 2);
    await controller.myStatus(user, 3);
    expect(mockService.create).toHaveBeenCalledWith(7, { productId: 3, rating: 5 });
    expect(mockService.update).toHaveBeenCalledWith(7, 1, { rating: 4 });
    expect(mockService.remove).toHaveBeenCalledWith(7, 1);
    expect(mockService.toggleHelpful).toHaveBeenCalledWith(7, 2);
    expect(mockService.myStatus).toHaveBeenCalledWith(7, 3);
  });
});
