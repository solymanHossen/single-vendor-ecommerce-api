import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { AttributesService } from './attributes.service';
import { PrismaService } from '../database/prisma.service';

const mockPrisma = {
  attribute: {
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  attributeOption: {
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
};

const sampleOptionRow = {
  id: 10,
  attributeId: 3,
  value: 'Red',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const sampleAttributeRow = {
  id: 3,
  name: 'Color',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  options: [sampleOptionRow],
};

describe('AttributesService', () => {
  let service: AttributesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AttributesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<AttributesService>(AttributesService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('maps every attribute row into an AttributeEntity with its options', async () => {
      mockPrisma.attribute.findMany.mockResolvedValueOnce([sampleAttributeRow]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]?.options).toHaveLength(1);
      expect(result[0]?.options[0]?.value).toBe('Red');
    });
  });

  describe('findOne()', () => {
    it('maps the Prisma row into an AttributeEntity', async () => {
      mockPrisma.attribute.findUniqueOrThrow.mockResolvedValueOnce(sampleAttributeRow);

      const result = await service.findOne(3);

      expect(mockPrisma.attribute.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 3 } }),
      );
      expect(result.name).toBe('Color');
    });
  });

  describe('create()', () => {
    it('creates the attribute and maps the result', async () => {
      mockPrisma.attribute.create.mockResolvedValueOnce({ ...sampleAttributeRow, options: [] });

      const result = await service.create({ name: 'Color' });

      expect(mockPrisma.attribute.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: 'Color' } }),
      );
      expect(result.name).toBe('Color');
    });
  });

  describe('update()', () => {
    it('updates the attribute and maps the result', async () => {
      mockPrisma.attribute.update.mockResolvedValueOnce({ ...sampleAttributeRow, name: 'Colour' });

      const result = await service.update(3, { name: 'Colour' });

      expect(mockPrisma.attribute.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 3 }, data: { name: 'Colour' } }),
      );
      expect(result.name).toBe('Colour');
    });
  });

  describe('remove()', () => {
    it('deletes the attribute by id', async () => {
      mockPrisma.attribute.delete.mockResolvedValueOnce(sampleAttributeRow);

      await service.remove(3);

      expect(mockPrisma.attribute.delete).toHaveBeenCalledWith({ where: { id: 3 } });
    });
  });

  describe('addOption()', () => {
    it('creates an option scoped to the given attribute', async () => {
      mockPrisma.attributeOption.create.mockResolvedValueOnce(sampleOptionRow);

      const result = await service.addOption(3, { value: 'Red' });

      expect(mockPrisma.attributeOption.create).toHaveBeenCalledWith({
        data: { attributeId: 3, value: 'Red' },
        select: expect.any(Object),
      });
      expect(result.value).toBe('Red');
    });
  });

  describe('updateOption()', () => {
    it('updates the option when it belongs to the given attribute', async () => {
      mockPrisma.attributeOption.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.attributeOption.findUniqueOrThrow.mockResolvedValueOnce({
        ...sampleOptionRow,
        value: 'Crimson',
      });

      const result = await service.updateOption(3, 10, { value: 'Crimson' });

      expect(mockPrisma.attributeOption.updateMany).toHaveBeenCalledWith({
        where: { id: 10, attributeId: 3 },
        data: { value: 'Crimson' },
      });
      expect(result.value).toBe('Crimson');
    });

    it('throws NotFoundException when the option does not belong to the attribute', async () => {
      mockPrisma.attributeOption.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.updateOption(3, 999, { value: 'Crimson' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeOption()', () => {
    it('deletes the option when it belongs to the given attribute', async () => {
      mockPrisma.attributeOption.deleteMany.mockResolvedValueOnce({ count: 1 });

      await service.removeOption(3, 10);

      expect(mockPrisma.attributeOption.deleteMany).toHaveBeenCalledWith({
        where: { id: 10, attributeId: 3 },
      });
    });

    it('throws NotFoundException when the option does not belong to the attribute', async () => {
      mockPrisma.attributeOption.deleteMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.removeOption(3, 999)).rejects.toThrow(NotFoundException);
    });
  });
});
