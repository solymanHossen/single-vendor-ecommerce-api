import { Test, type TestingModule } from '@nestjs/testing';
import { ProductVariantsService } from './product-variants.service';
import { PrismaService } from '../database/prisma.service';

const mockPrisma = {
  product: {
    findUniqueOrThrow: jest.fn(),
  },
  productVariant: {
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const sampleRow = {
  id: 201,
  productId: 101,
  sku: 'IPH17PRO-256-RED',
  price: 999,
  stockQuantity: 12,
  imageUrl: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  options: [
    {
      attributeOption: { id: 10, value: 'Red', attributeId: 3, attribute: { name: 'Color' } },
    },
  ],
};

describe('ProductVariantsService', () => {
  let service: ProductVariantsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductVariantsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ProductVariantsService>(ProductVariantsService);
    jest.clearAllMocks();
  });

  describe('findAllByProduct()', () => {
    it('verifies the product exists, then maps its variants', async () => {
      mockPrisma.product.findUniqueOrThrow.mockResolvedValueOnce({ id: 101 });
      mockPrisma.productVariant.findMany.mockResolvedValueOnce([sampleRow]);

      const result = await service.findAllByProduct(101);

      expect(mockPrisma.product.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 101 } }),
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.options[0]?.attributeName).toBe('Color');
    });
  });

  describe('findOne()', () => {
    it('maps the Prisma row into a ProductVariantEntity', async () => {
      mockPrisma.productVariant.findUniqueOrThrow.mockResolvedValueOnce(sampleRow);

      const result = await service.findOne(201);

      expect(result.sku).toBe('IPH17PRO-256-RED');
      expect(result.options).toHaveLength(1);
      expect(result.options[0]?.value).toBe('Red');
    });
  });

  describe('create()', () => {
    it('creates a variant with a nested options.create write', async () => {
      mockPrisma.productVariant.create.mockResolvedValueOnce(sampleRow);

      await service.create(101, {
        sku: 'IPH17PRO-256-RED',
        price: 999,
        stockQuantity: 12,
        attributeOptionIds: [10],
      });

      expect(mockPrisma.productVariant.create).toHaveBeenCalledWith({
        data: {
          sku: 'IPH17PRO-256-RED',
          price: 999,
          stockQuantity: 12,
          productId: 101,
          options: { create: [{ attributeOptionId: 10 }] },
        },
        select: expect.any(Object),
      });
    });
  });

  describe('update()', () => {
    it('replaces the option set with deleteMany + create when attributeOptionIds are provided', async () => {
      mockPrisma.productVariant.update.mockResolvedValueOnce(sampleRow);

      await service.update(201, { attributeOptionIds: [10, 11] });

      const callArgs = mockPrisma.productVariant.update.mock.calls[0][0] as {
        data: { options?: { deleteMany: unknown; create: unknown } };
      };
      expect(callArgs.data.options).toEqual({
        deleteMany: {},
        create: [{ attributeOptionId: 10 }, { attributeOptionId: 11 }],
      });
    });

    it('leaves options untouched when attributeOptionIds is not provided', async () => {
      mockPrisma.productVariant.update.mockResolvedValueOnce(sampleRow);

      await service.update(201, { price: 899 });

      expect(mockPrisma.productVariant.update).toHaveBeenCalledWith({
        where: { id: 201 },
        data: { price: 899 },
        select: expect.any(Object),
      });
    });
  });

  describe('remove()', () => {
    it('deletes the variant by id', async () => {
      mockPrisma.productVariant.delete.mockResolvedValueOnce(sampleRow);

      await service.remove(201);

      expect(mockPrisma.productVariant.delete).toHaveBeenCalledWith({ where: { id: 201 } });
    });
  });
});
