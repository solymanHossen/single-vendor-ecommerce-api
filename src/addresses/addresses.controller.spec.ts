import { Test, type TestingModule } from '@nestjs/testing';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';
import { AddressEntity } from './entities/address.entity';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockAddressesService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const currentUser: AuthUser = {
  id: 10,
  email: 'jane.doe@example.com',
  role: 'USER',
  isActive: true,
};

const sampleAddress = new AddressEntity({
  id: 1,
  userId: 10,
  addressLine1: '123 Main St',
  addressLine2: null,
  city: 'Springfield',
  state: 'IL',
  postalCode: '62704',
  country: 'USA',
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('AddressesController', () => {
  let controller: AddressesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AddressesController],
      providers: [{ provide: AddressesService, useValue: mockAddressesService }],
    }).compile();

    controller = module.get<AddressesController>(AddressesController);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it("delegates to the service with the current user's id", async () => {
      mockAddressesService.findAll.mockResolvedValueOnce([sampleAddress]);

      const result = await controller.findAll(currentUser);

      expect(mockAddressesService.findAll).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        message: 'Addresses retrieved successfully',
        data: [sampleAddress],
      });
    });
  });

  describe('findOne()', () => {
    it('delegates to the service with user id and address id', async () => {
      mockAddressesService.findOne.mockResolvedValueOnce(sampleAddress);

      const result = await controller.findOne(currentUser, 1);

      expect(mockAddressesService.findOne).toHaveBeenCalledWith(10, 1);
      expect(result).toEqual({ message: 'Address retrieved successfully', data: sampleAddress });
    });
  });

  describe('create()', () => {
    it('delegates to the service with user id and dto', async () => {
      mockAddressesService.create.mockResolvedValueOnce(sampleAddress);
      const dto = {
        addressLine1: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        postalCode: '62704',
        country: 'USA',
        isDefault: false,
      };

      const result = await controller.create(currentUser, dto);

      expect(mockAddressesService.create).toHaveBeenCalledWith(10, dto);
      expect(result).toEqual({ message: 'Address created successfully', data: sampleAddress });
    });
  });

  describe('update()', () => {
    it('delegates to the service with user id, address id, and dto', async () => {
      mockAddressesService.update.mockResolvedValueOnce(sampleAddress);

      const result = await controller.update(currentUser, 1, { city: 'Shelbyville' });

      expect(mockAddressesService.update).toHaveBeenCalledWith(10, 1, { city: 'Shelbyville' });
      expect(result).toEqual({ message: 'Address updated successfully', data: sampleAddress });
    });
  });

  describe('remove()', () => {
    it('delegates to the service and returns a null-data envelope', async () => {
      mockAddressesService.remove.mockResolvedValueOnce(undefined);

      const result = await controller.remove(currentUser, 1);

      expect(mockAddressesService.remove).toHaveBeenCalledWith(10, 1);
      expect(result).toEqual({ message: 'Address deleted successfully', data: null });
    });
  });
});
