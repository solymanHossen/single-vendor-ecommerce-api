import { Injectable, Logger } from '@nestjs/common';
import type { IMailProvider, SendMailOptions } from '../interfaces/mail-provider.interface';

/**
 * Zero-configuration default: logs the email instead of sending it. Lets the
 * app boot and the password-reset flow work end-to-end in local dev / CI
 * without SMTP credentials. Never selected when MAIL_PROVIDER=smtp.
 */
@Injectable()
export class ConsoleMailProvider implements IMailProvider {
  private readonly logger = new Logger(ConsoleMailProvider.name);

  send(options: SendMailOptions): Promise<void> {
    this.logger.warn(
      `📧 MAIL_PROVIDER=console — email NOT actually sent. Set MAIL_PROVIDER=smtp for real delivery.\n` +
        `  To:      ${options.to}\n` +
        `  Subject: ${options.subject}\n` +
        `  Body:\n${options.text}`,
    );
    return Promise.resolve();
  }
}
