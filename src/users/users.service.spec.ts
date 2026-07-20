import { Test, type TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../database/prisma.service';

const mockPrisma = {
  user: {
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
};

const sampleUserRow = {
  id: 1,
  email: 'jane.doe@example.com',
  name: 'Jane Doe',
  phone: '+1 555-0100',
  avatarUrl: 'https://cdn.example.com/avatars/1.jpg',
  role: 'USER' as const,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('getProfile()', () => {
    it('maps the Prisma row into a UserProfileEntity', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValueOnce(sampleUserRow);

      const result = await service.getProfile(1);

      expect(mockPrisma.user.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } }),
      );
      expect(result.email).toBe('jane.doe@example.com');
      expect(result.phone).toBe('+1 555-0100');
    });
  });

  describe('updateProfile()', () => {
    it('updates only the provided fields and maps the result', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({ ...sampleUserRow, name: 'Jane Q. Doe' });

      const result = await service.updateProfile(1, { name: 'Jane Q. Doe' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'Jane Q. Doe' },
        select: expect.any(Object),
      });
      expect(result.name).toBe('Jane Q. Doe');
    });

    it('clears avatarUrl when explicitly set to null', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({ ...sampleUserRow, avatarUrl: null });

      const result = await service.updateProfile(1, { avatarUrl: null });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { avatarUrl: null },
        select: expect.any(Object),
      });
      expect(result.avatarUrl).toBeNull();
    });
  });
});
