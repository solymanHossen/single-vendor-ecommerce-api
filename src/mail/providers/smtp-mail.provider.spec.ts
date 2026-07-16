import type { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SmtpMailProvider } from './smtp-mail.provider';

const mockSendMail = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: mockSendMail,
  })),
}));

function buildConfigService(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    MAIL_FROM: 'no-reply@example.com',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: 587,
    SMTP_USER: 'smtp-user',
    SMTP_PASSWORD: 'smtp-pass',
    ...overrides,
  };

  return {
    getOrThrow: jest.fn((key: string) => {
      const value = values[key];
      if (value === undefined) throw new Error(`Missing required config value: ${key}`);
      return value;
    }),
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('SmtpMailProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail.mockResolvedValue(undefined);
  });

  it('builds a nodemailer transport from SMTP_* config', () => {
    new SmtpMailProvider(buildConfigService());

    expect(jest.mocked(nodemailer.createTransport)).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: 587,
        auth: { user: 'smtp-user', pass: 'smtp-pass' },
      }),
    );
  });

  it('sends the email via the transport using MAIL_FROM as the sender', async () => {
    const provider = new SmtpMailProvider(buildConfigService());

    await provider.send({
      to: 'user@example.com',
      subject: 'Reset your password',
      html: '<p>reset</p>',
      text: 'reset',
    });

    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'no-reply@example.com',
      to: 'user@example.com',
      subject: 'Reset your password',
      html: '<p>reset</p>',
      text: 'reset',
    });
  });

  it('wraps a transport failure in a ServiceUnavailableException', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('connection refused'));
    const provider = new SmtpMailProvider(buildConfigService());

    await expect(
      provider.send({
        to: 'user@example.com',
        subject: 'Reset your password',
        html: '<p>reset</p>',
        text: 'reset',
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
