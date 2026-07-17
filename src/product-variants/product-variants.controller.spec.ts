import { Test, type TestingModule } from '@nestjs/testing';
import { ProductVariantsController } from './product-variants.controller';
import { ProductVariantsService } from './product-variants.service';
import { ProductVariantEntity } from './entities/product-variant.entity';

const mockProductVariantsService = {
  findAllByProduct: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const sampleVariant = new ProductVariantEntity({
  id: 201,
  productId: 101,
  sku: 'IPH17PRO-256-RED',
  price: 999 as unknown as ProductVariantEntity['price'],
  stockQuantity: 12,
  imageUrl: null,
  options: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('ProductVariantsController', () => {
  let controller: ProductVariantsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductVariantsController],
      providers: [{ provide: ProductVariantsService, useValue: mockProductVariantsService }],
    }).compile();

    controller = module.get<ProductVariantsController>(ProductVariantsController);
    jest.clearAllMocks();
  });

  describe('findAllByProduct()', () => {
    it('delegates to the service and wraps the result', async () => {
      mockProductVariantsService.findAllByProduct.mockResolvedValueOnce([sampleVariant]);

      const result = await controller.findAllByProduct(101);

      expect(mockProductVariantsService.findAllByProduct).toHaveBeenCalledWith(101);
      expect(result).toEqual({
        message: 'Product variants retrieved successfully',
        data: [sampleVariant],
      });
    });
  });

  describe('create()', () => {
    it('delegates to the service with productId and dto', async () => {
      mockProductVariantsService.create.mockResolvedValueOnce(sampleVariant);
      const dto = {
        sku: 'IPH17PRO-256-RED',
        price: 999,
        stockQuantity: 12,
        attributeOptionIds: [10],
      };

      const result = await controller.create(101, dto);

      expect(mockProductVariantsService.create).toHaveBeenCalledWith(101, dto);
      expect(result).toEqual({
        message: 'Product variant created successfully',
        data: sampleVariant,
      });
    });
  });

  describe('findOne()', () => {
    it('delegates to the service and wraps the result', async () => {
      mockProductVariantsService.findOne.mockResolvedValueOnce(sampleVariant);

      const result = await controller.findOne(201);

      expect(mockProductVariantsService.findOne).toHaveBeenCalledWith(201);
      expect(result).toEqual({
        message: 'Product variant retrieved successfully',
        data: sampleVariant,
      });
    });
  });

  describe('update()', () => {
    it('delegates to the service with id and dto', async () => {
      mockProductVariantsService.update.mockResolvedValueOnce(sampleVariant);

      const result = await controller.update(201, { price: 899 });

      expect(mockProductVariantsService.update).toHaveBeenCalledWith(201, { price: 899 });
      expect(result).toEqual({
        message: 'Product variant updated successfully',
        data: sampleVariant,
      });
    });
  });

  describe('remove()', () => {
    it('delegates to the service and returns a null-data envelope', async () => {
      mockProductVariantsService.remove.mockResolvedValueOnce(undefined);

      const result = await controller.remove(201);

      expect(mockProductVariantsService.remove).toHaveBeenCalledWith(201);
      expect(result).toEqual({ message: 'Product variant deleted successfully', data: null });
    });
  });
});
