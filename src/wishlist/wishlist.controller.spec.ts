import { Test, type TestingModule } from '@nestjs/testing';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';
import { WishlistItemEntity, WishlistProductSummaryEntity } from './entities/wishlist-item.entity';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockWishlistService = {
  findAll: jest.fn(),
  create: jest.fn(),
  remove: jest.fn(),
};

const currentUser: AuthUser = {
  id: 10,
  email: 'jane.doe@example.com',
  role: 'USER',
  isActive: true,
};

const sampleItem = new WishlistItemEntity({
  id: 5,
  productId: 101,
  product: new WishlistProductSummaryEntity({
    id: 101,
    name: 'iPhone 17 Pro',
    slug: 'iphone-17-pro',
    price: 999 as unknown as WishlistProductSummaryEntity['price'],
    imageUrl: null,
  }),
  createdAt: new Date(),
});

describe('WishlistController', () => {
  let controller: WishlistController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WishlistController],
      providers: [{ provide: WishlistService, useValue: mockWishlistService }],
    }).compile();

    controller = module.get<WishlistController>(WishlistController);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it("delegates to the service with the current user's id", async () => {
      mockWishlistService.findAll.mockResolvedValueOnce([sampleItem]);

      const result = await controller.findAll(currentUser);

      expect(mockWishlistService.findAll).toHaveBeenCalledWith(10);
      expect(result).toEqual({ message: 'Wishlist retrieved successfully', data: [sampleItem] });
    });
  });

  describe('create()', () => {
    it("delegates to the service with the current user's id and dto", async () => {
      mockWishlistService.create.mockResolvedValueOnce(sampleItem);

      const result = await controller.create(currentUser, { productId: 101 });

      expect(mockWishlistService.create).toHaveBeenCalledWith(10, { productId: 101 });
      expect(result).toEqual({
        message: 'Product added to wishlist successfully',
        data: sampleItem,
      });
    });
  });

  describe('remove()', () => {
    it('delegates to the service and returns a null-data envelope', async () => {
      mockWishlistService.remove.mockResolvedValueOnce(undefined);

      const result = await controller.remove(currentUser, 101);

      expect(mockWishlistService.remove).toHaveBeenCalledWith(10, 101);
      expect(result).toEqual({
        message: 'Product removed from wishlist successfully',
        data: null,
      });
    });
  });
});
