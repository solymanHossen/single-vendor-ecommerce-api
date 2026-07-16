import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Single source of truth for this app's identity metadata (name, description,
 * semantic version), sourced from the validated `APP_NAME` / `APP_DESCRIPTION`
 * / `APP_VERSION` environment variables (see env.validation.ts — all three
 * carry Zod defaults, so `getOrThrow` here can never actually throw).
 *
 * Every consumer — Swagger docs in main.ts, outbound email templates in
 * MailService, future audit-log/billing-header code — reads from this one
 * place instead of each re-reading ConfigService and duplicating its own
 * fallback literal, which is what invites the values to drift apart.
 */
@Injectable()
export class AppIdentityService {
  readonly name: string;
  readonly description: string;
  readonly version: string;

  constructor(configService: ConfigService) {
    this.name = configService.getOrThrow<string>('APP_NAME');
    this.description = configService.getOrThrow<string>('APP_DESCRIPTION');
    this.version = configService.getOrThrow<string>('APP_VERSION');
  }
}
