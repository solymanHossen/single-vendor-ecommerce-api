import { Test, type TestingModule } from '@nestjs/testing';
import { AttributesController } from './attributes.controller';
import { AttributesService } from './attributes.service';
import { AttributeEntity, AttributeOptionEntity } from './entities/attribute.entity';

const mockAttributesService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  addOption: jest.fn(),
  updateOption: jest.fn(),
  removeOption: jest.fn(),
};

const sampleAttribute = new AttributeEntity({
  id: 3,
  name: 'Color',
  options: [
    new AttributeOptionEntity({
      id: 10,
      attributeId: 3,
      value: 'Red',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('AttributesController', () => {
  let controller: AttributesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttributesController],
      providers: [{ provide: AttributesService, useValue: mockAttributesService }],
    }).compile();

    controller = module.get<AttributesController>(AttributesController);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('delegates to the service and wraps the result', async () => {
      mockAttributesService.findAll.mockResolvedValueOnce([sampleAttribute]);

      const result = await controller.findAll();

      expect(mockAttributesService.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        message: 'Attributes retrieved successfully',
        data: [sampleAttribute],
      });
    });
  });

  describe('findOne()', () => {
    it('delegates to the service and wraps the result', async () => {
      mockAttributesService.findOne.mockResolvedValueOnce(sampleAttribute);

      const result = await controller.findOne(3);

      expect(mockAttributesService.findOne).toHaveBeenCalledWith(3);
      expect(result).toEqual({
        message: 'Attribute retrieved successfully',
        data: sampleAttribute,
      });
    });
  });

  describe('create()', () => {
    it('delegates to the service and wraps the result', async () => {
      mockAttributesService.create.mockResolvedValueOnce(sampleAttribute);

      const result = await controller.create({ name: 'Color' });

      expect(mockAttributesService.create).toHaveBeenCalledWith({ name: 'Color' });
      expect(result).toEqual({ message: 'Attribute created successfully', data: sampleAttribute });
    });
  });

  describe('update()', () => {
    it('delegates to the service with id and dto', async () => {
      mockAttributesService.update.mockResolvedValueOnce(sampleAttribute);

      const result = await controller.update(3, { name: 'Colour' });

      expect(mockAttributesService.update).toHaveBeenCalledWith(3, { name: 'Colour' });
      expect(result).toEqual({ message: 'Attribute updated successfully', data: sampleAttribute });
    });
  });

  describe('remove()', () => {
    it('delegates to the service and returns a null-data envelope', async () => {
      mockAttributesService.remove.mockResolvedValueOnce(undefined);

      const result = await controller.remove(3);

      expect(mockAttributesService.remove).toHaveBeenCalledWith(3);
      expect(result).toEqual({ message: 'Attribute deleted successfully', data: null });
    });
  });

  describe('addOption()', () => {
    it('delegates to the service with the attribute id and dto', async () => {
      const option = sampleAttribute.options[0];
      if (!option) {
        throw new Error('sample attribute must have at least one option');
      }
      mockAttributesService.addOption.mockResolvedValueOnce(option);

      const result = await controller.addOption(3, { value: 'Red' });

      expect(mockAttributesService.addOption).toHaveBeenCalledWith(3, { value: 'Red' });
      expect(result).toEqual({ message: 'Attribute option created successfully', data: option });
    });
  });

  describe('updateOption()', () => {
    it('delegates to the service with attribute id, option id, and dto', async () => {
      const option = sampleAttribute.options[0];
      if (!option) {
        throw new Error('sample attribute must have at least one option');
      }
      mockAttributesService.updateOption.mockResolvedValueOnce(option);

      const result = await controller.updateOption(3, 10, { value: 'Crimson' });

      expect(mockAttributesService.updateOption).toHaveBeenCalledWith(3, 10, { value: 'Crimson' });
      expect(result).toEqual({ message: 'Attribute option updated successfully', data: option });
    });
  });

  describe('removeOption()', () => {
    it('delegates to the service and returns a null-data envelope', async () => {
      mockAttributesService.removeOption.mockResolvedValueOnce(undefined);

      const result = await controller.removeOption(3, 10);

      expect(mockAttributesService.removeOption).toHaveBeenCalledWith(3, 10);
      expect(result).toEqual({ message: 'Attribute option deleted successfully', data: null });
    });
  });
});
