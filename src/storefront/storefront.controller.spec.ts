import { Test, type TestingModule } from '@nestjs/testing';
import { StorefrontController } from './storefront.controller';
import { StorefrontService } from './storefront.service';
import { NavigationEntity } from './entities/navigation.entity';
import { StorefrontCatalogService } from './storefront-catalog.service';
import type { CatalogQueryDto } from './dto/catalog-query.dto';

const mockStorefrontService = { getNavigation: jest.fn() };
const mockCatalogService = { listProducts: jest.fn(), getProduct: jest.fn() };

describe('StorefrontController', () => {
  let controller: StorefrontController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorefrontController],
      providers: [
        { provide: StorefrontService, useValue: mockStorefrontService },
        { provide: StorefrontCatalogService, useValue: mockCatalogService },
      ],
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

  it('delegates catalog listing with the validated query', async () => {
    const query: CatalogQueryDto = { page: 1, limit: 24, sort: 'featured', category: 'audio' };
    const page = { items: [], meta: { page: 1, limit: 24, total: 0, totalPages: 0 } };
    mockCatalogService.listProducts.mockResolvedValue(page);

    const result = await controller.listProducts(query);

    expect(mockCatalogService.listProducts).toHaveBeenCalledWith(query);
    expect(result).toEqual({ message: 'Products retrieved successfully', data: page });
  });

  it('delegates product detail lookups by id or slug', async () => {
    const product = { id: 1, slug: 'iphone-15-pro' };
    mockCatalogService.getProduct.mockResolvedValue(product);

    const result = await controller.getProduct('iphone-15-pro');

    expect(mockCatalogService.getProduct).toHaveBeenCalledWith('iphone-15-pro');
    expect(result).toEqual({ message: 'Product retrieved successfully', data: product });
  });
});
