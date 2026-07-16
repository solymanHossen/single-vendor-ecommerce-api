import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import type { IStorageProvider, StorageResponse } from '../interfaces/storage-provider.interface';
import { SAFE_FILENAME_PATTERN, SAFE_FOLDER_PATTERN } from '../storage.constants';
import { buildStreamUrl } from '../storage.utils';

@Injectable()
export class S3StorageProvider implements IStorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('STORAGE_AWS_ENDPOINT');

    this.client = new S3Client({
      region: this.configService.get<string>('STORAGE_AWS_REGION') ?? 'us-east-1',
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('STORAGE_AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>('STORAGE_AWS_SECRET_ACCESS_KEY'),
      },
      // S3-compatible services (Cloudflare R2, MinIO, ...) require path-style addressing.
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });
    this.bucket = this.configService.getOrThrow<string>('STORAGE_AWS_BUCKET_NAME');
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<StorageResponse> {
    const safeFolder = this.assertSafeFolder(folder);
    const extension = path.extname(file.originalname).toLowerCase();
    const objectKey = `${safeFolder}/${randomUUID()}${extension}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
          Body: file.buffer,
          ContentType: file.mimetype,
          ContentLength: file.size,
        }),
      );
    } catch (error: unknown) {
      throw new InternalServerErrorException(
        `Cloud storage upload failed: ${this.errorMessage(error)}`,
      );
    }

    return {
      key: objectKey,
      url: buildStreamUrl(this.configService, objectKey),
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  async deleteFile(objectKey: string): Promise<void> {
    this.assertSafeKey(objectKey);

    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
    } catch (error: unknown) {
      throw new InternalServerErrorException(
        `Cloud storage delete failed: ${this.errorMessage(error)}`,
      );
    }
  }

  async getFileStream(objectKey: string): Promise<NodeJS.ReadableStream> {
    this.assertSafeKey(objectKey);

    let body: unknown;
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      body = response.Body;
    } catch (error: unknown) {
      if (this.isMissingObjectError(error)) {
        throw new NotFoundException(
          'The requested resource does not exist on the storage provider engine',
        );
      }
      throw new InternalServerErrorException(
        `Cloud storage read failed: ${this.errorMessage(error)}`,
      );
    }

    if (!(body instanceof Readable)) {
      throw new InternalServerErrorException('Cloud storage engine returned an unreadable payload');
    }

    return body;
  }

  private assertSafeFolder(folder: string): string {
    if (!SAFE_FOLDER_PATTERN.test(folder)) {
      throw new BadRequestException('Invalid storage folder');
    }
    return folder;
  }

  private assertSafeKey(objectKey: string): void {
    const segments = objectKey.split('/');
    const [folder, filename] = segments;

    if (
      segments.length !== 2 ||
      !folder ||
      !SAFE_FOLDER_PATTERN.test(folder) ||
      !filename ||
      !SAFE_FILENAME_PATTERN.test(filename)
    ) {
      throw new BadRequestException('Invalid storage object key');
    }
  }

  private isMissingObjectError(error: unknown): boolean {
    return error instanceof Error && (error.name === 'NoSuchKey' || error.name === 'NotFound');
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
