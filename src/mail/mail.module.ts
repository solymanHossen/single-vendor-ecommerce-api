import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAIL_IO_TOKEN } from './mail.constants';
import { MailService } from './mail.service';
import { ConsoleMailProvider } from './providers/console-mail.provider';
import { SmtpMailProvider } from './providers/smtp-mail.provider';
import type { IMailProvider } from './interfaces/mail-provider.interface';

@Global()
@Module({
  providers: [
    // `new` here (rather than registering both classes as providers) is deliberate: only one
    // implementation is ever active, and SmtpMailProvider's constructor requires SMTP
    // credentials that legitimately don't exist when MAIL_PROVIDER=console — eagerly
    // constructing both via the container would crash bootstrap in the zero-config default.
    {
      provide: MAIL_IO_TOKEN,
      useFactory: (configService: ConfigService): IMailProvider => {
        const provider = configService.get<string>('MAIL_PROVIDER') ?? 'console';
        return provider === 'smtp'
          ? new SmtpMailProvider(configService)
          : new ConsoleMailProvider();
      },
      inject: [ConfigService],
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
