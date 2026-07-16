import { Inject, Injectable } from '@nestjs/common';
import { AppIdentityService } from '../common/config/app-identity.service';
import { MAIL_IO_TOKEN } from './mail.constants';
import type { IMailProvider } from './interfaces/mail-provider.interface';

@Injectable()
export class MailService {
  constructor(
    @Inject(MAIL_IO_TOKEN) private readonly provider: IMailProvider,
    private readonly appIdentity: AppIdentityService,
  ) {}

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    const appName = this.appIdentity.name;

    await this.provider.send({
      to,
      subject: `Reset your ${appName} password`,
      text:
        `We received a request to reset your ${appName} password.\n\n` +
        `Reset it here (valid for a limited time): ${resetUrl}\n\n` +
        `If you didn't request this, you can safely ignore this email.\n\n` +
        `— The ${appName} Team`,
      html:
        `<p>We received a request to reset your ${appName} password.</p>` +
        `<p><a href="${resetUrl}">Click here to reset your password</a> (valid for a limited time).</p>` +
        `<p>If you didn't request this, you can safely ignore this email.</p>` +
        `<p>— The ${appName} Team</p>`,
    });
  }
}
