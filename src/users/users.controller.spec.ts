import { Test, type TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserProfileEntity } from './entities/user-profile.entity';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockUsersService = {
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
};

const currentUser: AuthUser = {
  id: 1,
  email: 'jane.doe@example.com',
  role: 'USER',
  isActive: true,
};

const sampleProfile = new UserProfileEntity({
  id: 1,
  email: 'jane.doe@example.com',
  name: 'Jane Doe',
  phone: '+1 555-0100',
  avatarUrl: null,
  role: 'USER',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  describe('getProfile()', () => {
    it("delegates to the service with the current user's id", async () => {
      mockUsersService.getProfile.mockResolvedValueOnce(sampleProfile);

      const result = await controller.getProfile(currentUser);

      expect(mockUsersService.getProfile).toHaveBeenCalledWith(1);
      expect(result).toEqual({ message: 'Profile retrieved successfully', data: sampleProfile });
    });
  });

  describe('updateProfile()', () => {
    it("delegates to the service with the current user's id and dto", async () => {
      mockUsersService.updateProfile.mockResolvedValueOnce(sampleProfile);

      const result = await controller.updateProfile(currentUser, { name: 'Jane Doe' });

      expect(mockUsersService.updateProfile).toHaveBeenCalledWith(1, { name: 'Jane Doe' });
      expect(result).toEqual({ message: 'Profile updated successfully', data: sampleProfile });
    });
  });
});
