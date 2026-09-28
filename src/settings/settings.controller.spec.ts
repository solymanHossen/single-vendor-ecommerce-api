import { Test, type TestingModule } from '@nestjs/testing';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { AuditService } from '../audit/audit.service';
import { ALL_PERMISSIONS } from '../access/permissions';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockAuditService = { record: jest.fn() };
const owner: AuthUser = {
  id: 1,
  email: 'owner@example.com',
  role: 'SUPER_ADMIN',
  isActive: true,
  permissions: [...ALL_PERMISSIONS],
};

const mockSettingsService = {
  getSettings: jest.fn(),
  updateSettings: jest.fn(),
};

describe('SettingsController', () => {
  let controller: SettingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    controller = module.get<SettingsController>(SettingsController);
    jest.clearAllMocks();
  });

  describe('getSettings()', () => {
    it('returns the current settings wrapped in a success envelope', async () => {
      mockSettingsService.getSettings.mockResolvedValueOnce({
        allowRegistration: true,
        enableGoogleLogin: false,
      });

      const result = await controller.getSettings();

      expect(mockSettingsService.getSettings).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        message: 'Settings retrieved successfully',
        data: { allowRegistration: true, enableGoogleLogin: false },
      });
    });
  });

  describe('getPublicSettings()', () => {
    it('serves the same cached settings to the storefront', async () => {
      mockSettingsService.getSettings.mockResolvedValueOnce({ storeName: 'AURA' });

      const result = await controller.getPublicSettings();

      expect(mockSettingsService.getSettings).toHaveBeenCalledTimes(1);
      expect(result.data.storeName).toBe('AURA');
    });
  });

  describe('updateSettings()', () => {
    it('delegates the partial update to the service and returns the result', async () => {
      mockSettingsService.updateSettings.mockResolvedValueOnce({
        allowRegistration: false,
        enableGoogleLogin: true,
      });

      const result = await controller.updateSettings(owner, '203.0.113.7', {
        allowRegistration: false,
      });

      expect(mockSettingsService.updateSettings).toHaveBeenCalledWith({
        allowRegistration: false,
      });
      expect(result).toEqual({
        message: 'Settings updated successfully',
        data: { allowRegistration: false, enableGoogleLogin: true },
      });
    });
  });

  it('records which settings changed, and by whom', async () => {
    mockSettingsService.updateSettings.mockResolvedValueOnce({ storeName: 'Nova' });

    await controller.updateSettings(owner, '203.0.113.7', { storeName: 'Nova', tagline: 'x' });

    expect(mockAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: owner,
        action: 'settings.updated',
        metadata: { fields: ['storeName', 'tagline'] },
        ipAddress: '203.0.113.7',
      }),
    );
  });
});
