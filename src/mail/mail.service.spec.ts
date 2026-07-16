import { Test, type TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import { MAIL_IO_TOKEN } from './mail.constants';
import { AppIdentityService } from '../common/config/app-identity.service';

const mockProvider = {
  send: jest.fn().mockResolvedValue(undefined),
};

const mockAppIdentityService = {
  name: 'Test Application',
  description: 'Test Application Description',
  version: '1.0.0',
};

describe('MailService', () => {
  let service: MailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: MAIL_IO_TOKEN, useValue: mockProvider },
        { provide: AppIdentityService, useValue: mockAppIdentityService },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    jest.clearAllMocks();
    mockProvider.send.mockResolvedValue(undefined);
  });

  describe('sendPasswordResetEmail()', () => {
    it('delegates to the active provider with a subject, html body, and text body branded with the app name', async () => {
      await service.sendPasswordResetEmail('user@example.com', 'https://app.example.com/reset');

      expect(mockProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Reset your Test Application password',
          html: expect.stringContaining('https://app.example.com/reset'),
          text: expect.stringContaining('https://app.example.com/reset'),
        }),
      );
      expect(mockProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Test Application'),
          text: expect.stringContaining('Test Application'),
        }),
      );
    });
  });
});
