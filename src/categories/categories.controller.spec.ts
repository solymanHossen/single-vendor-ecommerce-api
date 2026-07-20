import { Test, type TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CategoryEntity, CategoryTreeNodeEntity } from './entities/category.entity';

const mockCategoriesService = {
  findTree: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('CategoriesController', () => {
  let controller: CategoriesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: mockCategoriesService }],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('returns the category tree wrapped in a success envelope', async () => {
      const tree = [
        new CategoryTreeNodeEntity({
          id: 1,
          name: 'Electronics',
          slug: 'electronics',
          iconUrl: null,
          children: [],
        }),
      ];
      mockCategoriesService.findTree.mockResolvedValueOnce(tree);

      const result = await controller.findAll();

      expect(mockCategoriesService.findTree).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ message: 'Categories retrieved successfully', data: tree });
    });
  });

  describe('findOne()', () => {
    it('delegates to the service and wraps the result', async () => {
      const category = new CategoryEntity({
        id: 1,
        name: 'Electronics',
        slug: 'electronics',
        parentId: null,
        iconUrl: null,
        metaTitle: null,
        metaDesc: null,
        productCount: 0,
        parent: null,
        children: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockCategoriesService.findOne.mockResolvedValueOnce(category);

      const result = await controller.findOne(1);

      expect(mockCategoriesService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual({ message: 'Category retrieved successfully', data: category });
    });
  });

  describe('create()', () => {
    it('delegates to the service and wraps the result', async () => {
      const category = new CategoryEntity({
        id: 1,
        name: 'Electronics',
        slug: 'electronics',
        parentId: null,
        iconUrl: null,
        metaTitle: null,
        metaDesc: null,
        productCount: 0,
        parent: null,
        children: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockCategoriesService.create.mockResolvedValueOnce(category);

      const result = await controller.create({ name: 'Electronics', slug: 'electronics' });

      expect(mockCategoriesService.create).toHaveBeenCalledWith({
        name: 'Electronics',
        slug: 'electronics',
      });
      expect(result).toEqual({ message: 'Category created successfully', data: category });
    });
  });

  describe('update()', () => {
    it('delegates to the service with id and dto', async () => {
      const category = new CategoryEntity({
        id: 1,
        name: 'Gadgets',
        slug: 'electronics',
        parentId: null,
        iconUrl: null,
        metaTitle: null,
        metaDesc: null,
        productCount: 0,
        parent: null,
        children: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockCategoriesService.update.mockResolvedValueOnce(category);

      const result = await controller.update(1, { name: 'Gadgets' });

      expect(mockCategoriesService.update).toHaveBeenCalledWith(1, { name: 'Gadgets' });
      expect(result).toEqual({ message: 'Category updated successfully', data: category });
    });
  });

  describe('remove()', () => {
    it('delegates to the service and returns a null-data envelope', async () => {
      mockCategoriesService.remove.mockResolvedValueOnce(undefined);

      const result = await controller.remove(1);

      expect(mockCategoriesService.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual({ message: 'Category deleted successfully', data: null });
    });
  });
});
