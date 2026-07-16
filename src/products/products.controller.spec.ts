import { Test, type TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { PaginatedProductsEntity, ProductEntity } from './entities/product.entity';
import type { ProductQueryDto } from './dto/query-product.dto';

const mockProductsService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const sampleProduct = new ProductEntity({
  id: 1,
  categoryId: 2,
  category: { id: 2, name: 'Phones', slug: 'phones', iconUrl: null },
  name: 'iPhone 17 Pro',
  slug: 'iphone-17-pro',
  description: 'Flagship phone',
  basePrice: 999 as unknown as ProductEntity['basePrice'],
  discountPrice: null,
  sku: 'IPH17PRO',
  stockQuantity: 10,
  isPublished: true,
  metaTitle: null,
  metaDesc: null,
  images: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('ProductsController', () => {
  let controller: ProductsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: mockProductsService }],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('delegates the query dto to the service and wraps the result', async () => {
      const paginated = new PaginatedProductsEntity({
        items: [sampleProduct],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
      mockProductsService.findAll.mockResolvedValueOnce(paginated);
      const query: ProductQueryDto = { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' };

      const result = await controller.findAll(query);

      expect(mockProductsService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual({ message: 'Products retrieved successfully', data: paginated });
    });
  });

  describe('findOne()', () => {
    it('delegates to the service and wraps the result', async () => {
      mockProductsService.findOne.mockResolvedValueOnce(sampleProduct);

      const result = await controller.findOne(1);

      expect(mockProductsService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual({ message: 'Product retrieved successfully', data: sampleProduct });
    });
  });

  describe('create()', () => {
    it('delegates to the service and wraps the result', async () => {
      mockProductsService.create.mockResolvedValueOnce(sampleProduct);
      const dto = {
        categoryId: 2,
        name: 'iPhone 17 Pro',
        slug: 'iphone-17-pro',
        description: 'Flagship phone',
        basePrice: 999,
        sku: 'IPH17PRO',
        stockQuantity: 10,
        isPublished: true,
      };

      const result = await controller.create(dto);

      expect(mockProductsService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ message: 'Product created successfully', data: sampleProduct });
    });
  });

  describe('update()', () => {
    it('delegates to the service with id and dto', async () => {
      mockProductsService.update.mockResolvedValueOnce(sampleProduct);

      const result = await controller.update(1, { name: 'Renamed' });

      expect(mockProductsService.update).toHaveBeenCalledWith(1, { name: 'Renamed' });
      expect(result).toEqual({ message: 'Product updated successfully', data: sampleProduct });
    });
  });

  describe('remove()', () => {
    it('delegates to the service and returns a null-data envelope', async () => {
      mockProductsService.remove.mockResolvedValueOnce(undefined);

      const result = await controller.remove(1);

      expect(mockProductsService.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual({ message: 'Product deleted successfully', data: null });
    });
  });
});
