import { Test, type TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../database/prisma.service';

const mockPrisma = {
  category: {
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('CategoriesService', () => {
  let service: CategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    jest.clearAllMocks();
  });

  describe('findTree()', () => {
    it('returns an empty array when no categories exist', async () => {
      mockPrisma.category.findMany.mockResolvedValueOnce([]);

      const result = await service.findTree();

      expect(result).toEqual([]);
    });

    it('nests children under their parent, in a single query', async () => {
      mockPrisma.category.findMany.mockResolvedValueOnce([
        { id: 1, name: 'Electronics', slug: 'electronics', iconUrl: null, parentId: null },
        { id: 2, name: 'Phones', slug: 'phones', iconUrl: null, parentId: 1 },
        { id: 3, name: 'Accessories', slug: 'accessories', iconUrl: null, parentId: 1 },
        { id: 4, name: 'Cases', slug: 'cases', iconUrl: null, parentId: 3 },
      ]);

      const result = await service.findTree();

      expect(mockPrisma.category.findMany).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      const electronics = result[0];
      expect(electronics).toBeDefined();
      expect(electronics?.id).toBe(1);
      expect(electronics?.children).toHaveLength(2);
      const accessories = electronics?.children.find((child) => child.id === 3);
      expect(accessories?.children).toHaveLength(1);
      expect(accessories?.children[0]?.id).toBe(4);
    });
  });

  describe('findOne()', () => {
    it('maps the Prisma row into a CategoryEntity with productCount from _count', async () => {
      mockPrisma.category.findUniqueOrThrow.mockResolvedValueOnce({
        id: 1,
        name: 'Electronics',
        slug: 'electronics',
        parentId: null,
        iconUrl: null,
        metaTitle: null,
        metaDesc: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        parent: null,
        children: [],
        _count: { products: 12 },
      });

      const result = await service.findOne(1);

      expect(mockPrisma.category.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } }),
      );
      expect(result.productCount).toBe(12);
      expect(result.parent).toBeNull();
    });
  });

  describe('create()', () => {
    it('creates the category then re-fetches the fully-shaped entity', async () => {
      mockPrisma.category.create.mockResolvedValueOnce({ id: 5 });
      mockPrisma.category.findUniqueOrThrow.mockResolvedValueOnce({
        id: 5,
        name: 'Laptops',
        slug: 'laptops',
        parentId: null,
        iconUrl: null,
        metaTitle: null,
        metaDesc: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parent: null,
        children: [],
        _count: { products: 0 },
      });

      const result = await service.create({ name: 'Laptops', slug: 'laptops' });

      expect(mockPrisma.category.create).toHaveBeenCalledWith({
        data: { name: 'Laptops', slug: 'laptops' },
        select: { id: true },
      });
      expect(result.id).toBe(5);
    });
  });

  describe('update()', () => {
    it('updates the category then re-fetches the fully-shaped entity', async () => {
      mockPrisma.category.update.mockResolvedValueOnce({ id: 5 });
      mockPrisma.category.findUniqueOrThrow.mockResolvedValueOnce({
        id: 5,
        name: 'Notebooks',
        slug: 'laptops',
        parentId: null,
        iconUrl: null,
        metaTitle: null,
        metaDesc: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parent: null,
        children: [],
        _count: { products: 0 },
      });

      const result = await service.update(5, { name: 'Notebooks' });

      expect(mockPrisma.category.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { name: 'Notebooks' },
        select: { id: true },
      });
      expect(result.name).toBe('Notebooks');
    });
  });

  describe('remove()', () => {
    it('deletes the category by id', async () => {
      mockPrisma.category.delete.mockResolvedValueOnce({ id: 5 });

      await service.remove(5);

      expect(mockPrisma.category.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    });
  });
});
