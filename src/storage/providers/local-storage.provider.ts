import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IStorageProvider, StorageResponse } from '../interfaces/storage-provider.interface';
import { SAFE_FILENAME_PATTERN, SAFE_FOLDER_PATTERN } from '../storage.constants';
import { buildStreamUrl } from '../storage.utils';

@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly rootDir: string;

  constructor(private readonly configService: ConfigService) {
    this.rootDir = path.resolve(
      this.configService.get<string>('LOCAL_STORAGE_DEST') ?? './storage',
    );
    fs.mkdirSync(this.rootDir, { recursive: true });
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<StorageResponse> {
    const safeFolder = this.assertSafeFolder(folder);
    const targetDir = path.join(this.rootDir, safeFolder);
    await fs.promises.mkdir(targetDir, { recursive: true });

    const extension = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${randomUUID()}${extension}`;
    const destinationPath = path.join(targetDir, uniqueName);

    await fs.promises.writeFile(destinationPath, file.buffer);

    const objectKey = `${safeFolder}/${uniqueName}`;

    return {
      key: objectKey,
      url: buildStreamUrl(this.configService, objectKey),
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  async deleteFile(objectKey: string): Promise<void> {
    const fullPath = this.resolveSafePath(objectKey);
    // force: true makes this idempotent — deleting an already-gone key is not an error.
    await fs.promises.rm(fullPath, { force: true });
  }

  async getFileStream(objectKey: string): Promise<NodeJS.ReadableStream> {
    const fullPath = this.resolveSafePath(objectKey);

    try {
      await fs.promises.access(fullPath, fs.constants.R_OK);
    } catch {
      throw new NotFoundException(
        'The requested resource does not exist on the storage provider engine',
      );
    }

    return fs.createReadStream(fullPath);
  }

  /**
   * Splits and validates `<folder>/<filename>` before ever touching the filesystem, then
   * resolves the path and re-verifies it lands inside `rootDir`. Two independent checks
   * (structural allow-list + resolved-path containment) so a bug in either one alone can't
   * open a path-traversal hole.
   */
  private resolveSafePath(objectKey: string): string {
    const segments = objectKey.split('/');
    if (segments.length !== 2) {
      throw new BadRequestException('Invalid storage object key');
    }

    const [folder, filename] = segments;
    if (
      !folder ||
      !SAFE_FOLDER_PATTERN.test(folder) ||
      !filename ||
      !SAFE_FILENAME_PATTERN.test(filename)
    ) {
      throw new BadRequestException('Invalid storage object key');
    }

    const fullPath = path.resolve(this.rootDir, folder, filename);
    if (!fullPath.startsWith(`${this.rootDir}${path.sep}`)) {
      throw new BadRequestException('Invalid storage object key');
    }

    return fullPath;
  }

  private assertSafeFolder(folder: string): string {
    if (!SAFE_FOLDER_PATTERN.test(folder)) {
      throw new BadRequestException('Invalid storage folder');
    }
    return folder;
  }
}
