import { Test, type TestingModule } from '@nestjs/testing';
import { StorefrontController } from './storefront.controller';
import { StorefrontService } from './storefront.service';
import { NavigationEntity } from './entities/navigation.entity';

const mockStorefrontService = { getNavigation: jest.fn() };

describe('StorefrontController', () => {
  let controller: StorefrontController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorefrontController],
      providers: [{ provide: StorefrontService, useValue: mockStorefrontService }],
    }).compile();

    controller = module.get<StorefrontController>(StorefrontController);
    jest.clearAllMocks();
  });

  it('wraps the navigation payload in the standard response envelope', async () => {
    const navigation = new NavigationEntity({
      categories: [],
      collections: [],
      spotlight: null,
      trending: [],
      promotion: null,
      generatedAt: '2026-09-24T00:00:00.000Z',
    });
    mockStorefrontService.getNavigation.mockResolvedValue(navigation);

    const result = await controller.getNavigation();

    expect(result).toEqual({ message: 'Navigation retrieved successfully', data: navigation });
    expect(mockStorefrontService.getNavigation).toHaveBeenCalledTimes(1);
  });
});
