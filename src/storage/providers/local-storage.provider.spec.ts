import { BadRequestException, NotFoundException } from '@nestjs/common';
import { type ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { LocalStorageProvider } from './local-storage.provider';

function buildFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'photo.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 12,
    buffer: Buffer.from('test-content'),
    stream: Readable.from([]),
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

describe('LocalStorageProvider', () => {
  let rootDir: string;
  let provider: LocalStorageProvider;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-test-'));
    const configService = {
      get: jest.fn((key: string) => {
        const configMap: Record<string, string | number> = {
          LOCAL_STORAGE_DEST: rootDir,
          PORT: 3000,
        };
        return configMap[key];
      }),
    } as unknown as ConfigService;

    provider = new LocalStorageProvider(configService);
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  describe('uploadFile', () => {
    it('writes the buffer to disk under the requested folder and returns a stream URL', async () => {
      const file = buildFile();

      const result = await provider.uploadFile(file, 'avatars');

      expect(result.key).toMatch(/^avatars\/[0-9a-f-]+\.png$/);
      expect(result.url).toBe(`http://localhost:3000/api/v1/storage/stream/${result.key}`);
      expect(result.mimeType).toBe('image/png');
      expect(result.size).toBe(file.size);
      expect(fs.existsSync(path.join(rootDir, result.key))).toBe(true);
    });

    it('rejects a folder containing path-traversal segments', async () => {
      await expect(provider.uploadFile(buildFile(), '../../etc')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getFileStream', () => {
    it('streams back a previously uploaded object', async () => {
      const { key } = await provider.uploadFile(buildFile(), 'avatars');

      const stream = await provider.getFileStream(key);
      expect(stream).toBeInstanceOf(fs.ReadStream);

      // Fully settle the stream's lifecycle before the test ends — an fd whose async
      // open()/close() is still in flight when a later test's afterEach deletes its own
      // rootDir can fire an 'error' event that Jest attributes to whatever test runs next.
      const readStream = stream as fs.ReadStream;
      await new Promise<void>((resolve, reject) => {
        readStream.on('open', () => {
          readStream.destroy();
        });
        readStream.on('close', resolve);
        readStream.on('error', reject);
      });
    });

    it('throws NotFoundException for a well-formed but missing key', async () => {
      await expect(provider.getFileStream('avatars/does-not-exist.png')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException for a malformed key attempting traversal', async () => {
      await expect(provider.getFileStream('../../etc/passwd')).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteFile', () => {
    it('removes a previously uploaded object', async () => {
      const { key } = await provider.uploadFile(buildFile(), 'avatars');

      await provider.deleteFile(key);

      expect(fs.existsSync(path.join(rootDir, key))).toBe(false);
    });

    it('is idempotent when the object does not exist', async () => {
      await expect(provider.deleteFile('avatars/does-not-exist.png')).resolves.toBeUndefined();
    });
  });
});
