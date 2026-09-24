import { Test, type TestingModule } from '@nestjs/testing';
import { AdminProductsController } from './admin-products.controller';
import { AdminProductsService } from './admin-products.service';
import { ProductsService } from './products.service';
import { AdminProductQuerySchema } from './dto/admin-product-query.dto';
import { BulkProductStatusSchema } from './dto/bulk-product-status.dto';

const mockAdminProductsService = { findAll: jest.fn(), setPublished: jest.fn() };
const mockProductsService = { findOne: jest.fn() };

describe('AdminProductsController', () => {
  let controller: AdminProductsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminProductsController],
      providers: [
        { provide: AdminProductsService, useValue: mockAdminProductsService },
        { provide: ProductsService, useValue: mockProductsService },
      ],
    }).compile();

    controller = module.get<AdminProductsController>(AdminProductsController);
    jest.clearAllMocks();
  });

  it('findAll() delegates the parsed query and wraps the result', async () => {
    const page = { items: [], meta: {}, summary: {} };
    mockAdminProductsService.findAll.mockResolvedValueOnce(page);
    const query = AdminProductQuerySchema.parse({ status: 'draft' });

    const result = await controller.findAll(query);

    expect(mockAdminProductsService.findAll).toHaveBeenCalledWith(query);
    expect(result).toEqual({ message: 'Products retrieved successfully', data: page });
  });

  it('findOne() returns drafts too (no publishedOnly flag)', async () => {
    mockProductsService.findOne.mockResolvedValueOnce({ id: 5 });

    await controller.findOne(5);

    expect(mockProductsService.findOne).toHaveBeenCalledWith(5);
  });

  it('setStatus() reports how many products changed', async () => {
    mockAdminProductsService.setPublished.mockResolvedValueOnce({ updated: 1 });

    const result = await controller.setStatus({ ids: [9], isPublished: false });

    expect(result).toEqual({ message: '1 product unpublished', data: { updated: 1 } });
  });

  describe('DTOs', () => {
    it('defaults the query to every product, newest edit first', () => {
      expect(AdminProductQuerySchema.parse({})).toEqual({
        page: 1,
        limit: 20,
        status: 'all',
        stock: 'all',
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });
    });

    it('rejects unknown query fields', () => {
      expect(AdminProductQuerySchema.safeParse({ isPublished: 'true' }).success).toBe(false);
    });

    it('rejects duplicate or empty id lists for bulk status', () => {
      expect(BulkProductStatusSchema.safeParse({ ids: [1, 1], isPublished: true }).success).toBe(
        false,
      );
      expect(BulkProductStatusSchema.safeParse({ ids: [], isPublished: true }).success).toBe(false);
    });
  });
});
