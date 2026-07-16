import * as path from 'node:path';
import type { ConfigService } from '@nestjs/config';

const EXTENSION_CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
};

/**
 * Providers persist only the file's bytes, not its original MIME type, so the streaming
 * route resolves a Content-Type from the generated file's extension for the response header.
 * Unknown extensions fall back to a generic binary type — never trust the client-supplied
 * MIME type at read time since it isn't stored anywhere.
 */
export function resolveContentType(filename: string): string {
  const extension = path.extname(filename).toLowerCase();
  return EXTENSION_CONTENT_TYPES[extension] ?? 'application/octet-stream';
}

/**
 * Builds the absolute URL clients use to read back an uploaded object, regardless of which
 * provider stored it. Both local disk and cloud storage proxy reads through this API's own
 * `/storage/stream/:folder/:filename` route rather than exposing a raw filesystem or a
 * short-lived S3 presigned URL, so the link persisted by a caller (e.g. saved to a user's
 * avatar column) never expires.
 */
export function buildStreamUrl(configService: ConfigService, objectKey: string): string {
  const port = configService.get<number>('PORT') ?? 3000;
  const configuredAppUrl = configService.get<string>('APP_URL');
  const baseUrl = (configuredAppUrl ?? `http://localhost:${port}`).replace(/\/+$/, '');

  return `${baseUrl}/api/v1/storage/stream/${objectKey}`;
}
