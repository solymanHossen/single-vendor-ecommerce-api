import {
  BadRequestException,
  Inject,
  Injectable,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IStorageProvider, StorageResponse } from './interfaces/storage-provider.interface';
import { STORAGE_IO_TOKEN } from './storage.constants';

@Injectable()
export class StorageService {
  private readonly maxFileSizeBytes: number;
  private readonly allowedMimeTypes: ReadonlySet<string>;

  constructor(
    @Inject(STORAGE_IO_TOKEN) private readonly provider: IStorageProvider,
    private readonly configService: ConfigService,
  ) {
    const maxSizeMb = this.configService.get<number>('STORAGE_MAX_FILE_SIZE_MB') ?? 10;
    this.maxFileSizeBytes = maxSizeMb * 1024 * 1024;

    const allowList = this.configService.get<string>('STORAGE_ALLOWED_MIME_TYPES') ?? '';
    this.allowedMimeTypes = new Set(
      allowList
        .split(',')
        .map((type) => type.trim())
        .filter((type) => type.length > 0),
    );
  }

  async save(file: Express.Multer.File, folder: string): Promise<StorageResponse> {
    this.assertValidFile(file);
    return this.provider.uploadFile(file, folder);
  }

  async remove(objectKey: string): Promise<void> {
    await this.provider.deleteFile(objectKey);
  }

  async stream(objectKey: string): Promise<NodeJS.ReadableStream> {
    return this.provider.getFileStream(objectKey);
  }

  /**
   * Multer's `limits.fileSize` and `fileFilter` (wired in StorageModule) already reject
   * oversized/disallowed uploads before the whole payload is buffered into memory. This is a
   * second, explicit check at the domain boundary so the same guarantee holds for any future
   * caller of `save()` that bypasses the HTTP layer's Multer pipeline.
   */
  private assertValidFile(file: Express.Multer.File): void {
    if (file.size === 0) {
      throw new BadRequestException('Uploaded file is empty');
    }

    if (file.size > this.maxFileSizeBytes) {
      throw new PayloadTooLargeException(
        `File exceeds the maximum allowed size of ${this.maxFileSizeBytes / (1024 * 1024)}MB`,
      );
    }

    // Fails closed: an empty allow-list (STORAGE_ALLOWED_MIME_TYPES resolved
    // to nothing) rejects every upload rather than skipping the check —
    // the env schema already defaults this to a safe list, so an empty set
    // here means misconfiguration, not "no restriction intended".
    if (!this.allowedMimeTypes.has(file.mimetype)) {
      throw new UnsupportedMediaTypeException(
        this.allowedMimeTypes.size > 0
          ? `MIME type "${file.mimetype}" is not permitted. Allowed types: ${[...this.allowedMimeTypes].join(', ')}`
          : 'File uploads are not permitted: no allowed MIME types are configured.',
      );
    }
  }
}
