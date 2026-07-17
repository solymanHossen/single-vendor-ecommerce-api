import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { AddressesService } from './addresses.service';
import { PrismaService } from '../database/prisma.service';

const mockPrisma = {
  address: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const sampleRow = {
  id: 1,
  userId: 10,
  addressLine1: '123 Main St',
  addressLine2: null,
  city: 'Springfield',
  state: 'IL',
  postalCode: '62704',
  country: 'USA',
  isDefault: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('AddressesService', () => {
  let service: AddressesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AddressesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<AddressesService>(AddressesService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it("lists the user's addresses, defaults first", async () => {
      mockPrisma.address.findMany.mockResolvedValueOnce([sampleRow]);

      const result = await service.findAll(10);

      expect(mockPrisma.address.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 10 },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne()', () => {
    it('returns the address when owned by the user', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(sampleRow);

      const result = await service.findOne(10, 1);

      expect(mockPrisma.address.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1, userId: 10 } }),
      );
      expect(result.city).toBe('Springfield');
    });

    it('throws NotFoundException when not owned by the user', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(null);

      await expect(service.findOne(10, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('creates without a transaction when isDefault is false', async () => {
      mockPrisma.address.create.mockResolvedValueOnce(sampleRow);

      await service.create(10, {
        addressLine1: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        postalCode: '62704',
        country: 'USA',
        isDefault: false,
      });

      expect(mockPrisma.address.create).toHaveBeenCalledWith({
        data: {
          addressLine1: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          postalCode: '62704',
          country: 'USA',
          isDefault: false,
          userId: 10,
        },
        select: expect.any(Object),
      });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('clears other defaults inside a transaction when isDefault is true', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([
        { count: 1 },
        { ...sampleRow, isDefault: true },
      ]);

      const result = await service.create(10, {
        addressLine1: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        postalCode: '62704',
        country: 'USA',
        isDefault: true,
      });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.isDefault).toBe(true);
    });
  });

  describe('update()', () => {
    it('updates in place when isDefault is not being set to true', async () => {
      mockPrisma.address.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.address.findUniqueOrThrow.mockResolvedValueOnce({
        ...sampleRow,
        city: 'Shelbyville',
      });

      const result = await service.update(10, 1, { city: 'Shelbyville' });

      expect(mockPrisma.address.updateMany).toHaveBeenCalledWith({
        where: { id: 1, userId: 10 },
        data: { city: 'Shelbyville' },
      });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(result.city).toBe('Shelbyville');
    });

    it('clears other defaults inside a transaction when isDefault is true', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([{ count: 2 }, { count: 1 }]);
      mockPrisma.address.findUniqueOrThrow.mockResolvedValueOnce({ ...sampleRow, isDefault: true });

      const result = await service.update(10, 1, { isDefault: true });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.isDefault).toBe(true);
    });

    it('throws NotFoundException when the address is not owned by the user', async () => {
      mockPrisma.address.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.update(10, 999, { city: 'Nowhere' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove()', () => {
    it('deletes the address when owned by the user', async () => {
      mockPrisma.address.deleteMany.mockResolvedValueOnce({ count: 1 });

      await service.remove(10, 1);

      expect(mockPrisma.address.deleteMany).toHaveBeenCalledWith({ where: { id: 1, userId: 10 } });
    });

    it('throws NotFoundException when not owned by the user', async () => {
      mockPrisma.address.deleteMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.remove(10, 999)).rejects.toThrow(NotFoundException);
    });
  });
});
