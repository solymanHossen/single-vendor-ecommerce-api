import { Test, type TestingModule } from '@nestjs/testing';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

const mockSettingsService = {
  getSettings: jest.fn(),
  updateSettings: jest.fn(),
};

describe('SettingsController', () => {
  let controller: SettingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [{ provide: SettingsService, useValue: mockSettingsService }],
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

      const result = await controller.updateSettings({ allowRegistration: false });

      expect(mockSettingsService.updateSettings).toHaveBeenCalledWith({
        allowRegistration: false,
      });
      expect(result).toEqual({
        message: 'Settings updated successfully',
        data: { allowRegistration: false, enableGoogleLogin: true },
      });
    });
  });
});
