import { Test, type TestingModule } from '@nestjs/testing';
import { HeroBannersService } from './hero-banners.service';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { CreateHeroBannerDto } from './dto/create-hero-banner.dto';

const mockPrisma = {
  heroBanner: {
    findMany: jest.fn(),
    create: jest.fn(),
    aggregate: jest.fn(),
  },
};

const mockStorage = { remove: jest.fn() };

const row = {
  id: 9,
  placement: 'MAIN' as const,
  title: 'Sale',
  href: '/products?collection=on-sale',
  imageUrl: 'https://cdn.example.com/1.jpg',
  imageKey: 'hero-banners/1.jpg',
  sortOrder: 3,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const dto: CreateHeroBannerDto = {
  placement: 'MAIN',
  title: 'Sale',
  href: '/products?collection=on-sale',
  imageUrl: 'https://cdn.example.com/1.jpg',
  imageKey: 'hero-banners/1.jpg',
};

describe('HeroBannersService', () => {
  let service: HeroBannersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HeroBannersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();

    service = module.get<HeroBannersService>(HeroBannersService);
    jest.resetAllMocks();
  });

  describe('create()', () => {
    it('appends a banner after the last one in its placement', async () => {
      mockPrisma.heroBanner.aggregate.mockResolvedValue({ _max: { sortOrder: 2 } });
      mockPrisma.heroBanner.create.mockResolvedValue(row);

      await service.create(dto);

      expect(mockPrisma.heroBanner.aggregate).toHaveBeenCalledWith({
        where: { placement: 'MAIN' },
        _max: { sortOrder: true },
      });
      expect(mockPrisma.heroBanner.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { ...dto, sortOrder: 3 } }),
      );
    });

    it('starts at 0 when the placement is empty', async () => {
      mockPrisma.heroBanner.aggregate.mockResolvedValue({ _max: { sortOrder: null } });
      mockPrisma.heroBanner.create.mockResolvedValue(row);

      await service.create(dto);

      expect(mockPrisma.heroBanner.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { ...dto, sortOrder: 0 } }),
      );
    });

    it('respects an explicit sortOrder without querying', async () => {
      mockPrisma.heroBanner.create.mockResolvedValue(row);

      await service.create({ ...dto, sortOrder: 7 });

      expect(mockPrisma.heroBanner.aggregate).not.toHaveBeenCalled();
      expect(mockPrisma.heroBanner.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { ...dto, sortOrder: 7 } }),
      );
    });
  });

  describe('listing order', () => {
    it('breaks sortOrder ties by id for the storefront', async () => {
      mockPrisma.heroBanner.findMany.mockResolvedValue([]);

      await service.findPublic('MAIN');

      expect(mockPrisma.heroBanner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
      );
    });

    it('breaks sortOrder ties by id for admins', async () => {
      mockPrisma.heroBanner.findMany.mockResolvedValue([]);

      await service.findAllForAdmin();

      expect(mockPrisma.heroBanner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
        }),
      );
    });
  });
});
