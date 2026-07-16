import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { IMailProvider, SendMailOptions } from '../interfaces/mail-provider.interface';

@Injectable()
export class SmtpMailProvider implements IMailProvider {
  private readonly logger = new Logger(SmtpMailProvider.name);
  private readonly transporter: Transporter;
  private readonly fromAddress: string;

  constructor(configService: ConfigService) {
    this.fromAddress = configService.getOrThrow<string>('MAIL_FROM');

    this.transporter = nodemailer.createTransport({
      host: configService.getOrThrow<string>('SMTP_HOST'),
      port: configService.getOrThrow<number>('SMTP_PORT'),
      secure: configService.get<boolean>('SMTP_SECURE') ?? false,
      auth: {
        user: configService.getOrThrow<string>('SMTP_USER'),
        pass: configService.getOrThrow<string>('SMTP_PASSWORD'),
      },
    });
  }

  async send(options: SendMailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email via SMTP: ${message}`);
      throw new ServiceUnavailableException('Unable to send email at this time');
    }
  }
}
