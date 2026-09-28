import { Inject, Injectable } from '@nestjs/common';
import { AppIdentityService } from '../common/config/app-identity.service';
import { MAIL_IO_TOKEN } from './mail.constants';
import type { IMailProvider } from './interfaces/mail-provider.interface';

/** Text from users goes into HTML mail — never unescaped. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface TicketReplyMail {
  to: string;
  name: string | null;
  ticketId: number;
  subject: string;
  excerpt: string;
  url: string;
}

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

  /** "We replied to your request" — sent when support answers a ticket. */
  async sendTicketReplyEmail(mail: TicketReplyMail): Promise<void> {
    const appName = this.appIdentity.name;
    const greeting = mail.name ? `Hi ${mail.name.split(/\s+/)[0]},` : 'Hi,';

    await this.provider.send({
      to: mail.to,
      subject: `Re: ${mail.subject} [#${mail.ticketId}]`,
      text:
        `${greeting}\n\nWe replied to your request #${mail.ticketId} — "${mail.subject}":\n\n` +
        `${mail.excerpt}\n\nRead and reply here: ${mail.url}\n\n— The ${appName} Support Team`,
      html:
        `<p>${escapeHtml(greeting)}</p>` +
        `<p>We replied to your request <strong>#${mail.ticketId}</strong> — “${escapeHtml(mail.subject)}”:</p>` +
        `<blockquote style="margin:0;padding:12px 16px;border-left:3px solid #ddd;color:#333;white-space:pre-line">${escapeHtml(mail.excerpt)}</blockquote>` +
        `<p><a href="${escapeHtml(mail.url)}">Read and reply</a></p>` +
        `<p>— The ${escapeHtml(appName)} Support Team</p>`,
    });
  }
}
