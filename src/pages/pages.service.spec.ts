import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PagesService } from './pages.service';
import { PrismaService } from '../database/prisma.service';

const mockPage = {
  id: 1,
  slug: 'about',
  title: 'About Us',
  content: 'Our Story',
  isVisible: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('PagesService', () => {
  let service: PagesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagesService,
        {
          provide: PrismaService,
          useValue: {
            page: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PagesService>(PagesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return visible pages', async () => {
      jest.spyOn(prisma.page, 'findMany').mockResolvedValue([{ id: 1, slug: 'about', title: 'About Us', updatedAt: new Date() }] as any);
      const result = await service.findAll();
      expect(result).toHaveLength(1);
      expect(prisma.page.findMany).toHaveBeenCalledWith({
        where: { isVisible: true },
        select: { id: true, slug: true, title: true, updatedAt: true },
      });
    });
  });

  describe('findOne', () => {
    it('should return a page by slug', async () => {
      jest.spyOn(prisma.page, 'findUnique').mockResolvedValue(mockPage as any);
      const result = await service.findOne('about');
      expect(result).toEqual(mockPage);
    });

    it('should throw NotFoundException if page is invisible', async () => {
      jest.spyOn(prisma.page, 'findUnique').mockResolvedValue({ ...mockPage, isVisible: false } as any);
      await expect(service.findOne('about')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if page does not exist', async () => {
      jest.spyOn(prisma.page, 'findUnique').mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllAdmin', () => {
    it('should return all pages for admin', async () => {
      jest.spyOn(prisma.page, 'findMany').mockResolvedValue([mockPage] as any);
      const result = await service.findAllAdmin();
      expect(result).toHaveLength(1);
      expect(prisma.page.findMany).toHaveBeenCalledWith({ orderBy: { slug: 'asc' } });
    });
  });

  describe('findOneById', () => {
    it('should return a page by ID', async () => {
      jest.spyOn(prisma.page, 'findUnique').mockResolvedValue(mockPage as any);
      const result = await service.findOneById(1);
      expect(result).toEqual(mockPage);
    });

    it('should throw NotFoundException if page by ID does not exist', async () => {
      jest.spyOn(prisma.page, 'findUnique').mockResolvedValue(null);
      await expect(service.findOneById(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a page', async () => {
      jest.spyOn(prisma.page, 'update').mockResolvedValue({ ...mockPage, title: 'Updated' } as any);
      const result = await service.update(1, { title: 'Updated' });
      expect(result.title).toEqual('Updated');
    });

    it('should throw NotFoundException on error', async () => {
      jest.spyOn(prisma.page, 'update').mockRejectedValue(new Error('DB Error'));
      await expect(service.update(1, { title: 'Updated' })).rejects.toThrow(NotFoundException);
    });
  });
});
