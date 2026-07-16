import { Test, type TestingModule } from '@nestjs/testing';
import {
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';
import { StorageService } from './storage.service';
import { STORAGE_IO_TOKEN } from './storage.constants';
import type { StorageResponse } from './interfaces/storage-provider.interface';

// Deliberately not typed as `jest.Mocked<IStorageProvider>` — the interface declares its
// methods with method-shorthand syntax, which makes `expect(mockProvider.x)` trip
// @typescript-eslint/unbound-method. A plain object literal keeps each property a function
// type instead of a "method", sidestepping the false positive while staying structurally
// assignable to IStorageProvider via `useValue`.
const mockProvider = {
  uploadFile: jest.fn(),
  deleteFile: jest.fn(),
  getFileStream: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const configMap: Record<string, number | string> = {
      STORAGE_MAX_FILE_SIZE_MB: 1,
      STORAGE_ALLOWED_MIME_TYPES: 'image/png,image/jpeg',
    };
    return configMap[key];
  }),
};

function buildFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'photo.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.from('test-content'),
    stream: Readable.from([]),
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: STORAGE_IO_TOKEN, useValue: mockProvider },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  describe('save', () => {
    it('delegates to the active provider once the file passes validation', async () => {
      const file = buildFile();
      const expected: StorageResponse = {
        key: 'general/abc.png',
        url: 'http://localhost:3000/api/v1/storage/stream/general/abc.png',
        mimeType: 'image/png',
        size: file.size,
      };
      mockProvider.uploadFile.mockResolvedValue(expected);

      const result = await service.save(file, 'general');

      expect(result).toEqual(expected);
      expect(mockProvider.uploadFile).toHaveBeenCalledWith(file, 'general');
    });

    it('rejects an empty file before reaching the provider', async () => {
      const file = buildFile({ size: 0 });

      await expect(service.save(file, 'general')).rejects.toThrow(BadRequestException);
      expect(mockProvider.uploadFile).not.toHaveBeenCalled();
    });

    it('rejects a file larger than STORAGE_MAX_FILE_SIZE_MB', async () => {
      const file = buildFile({ size: 2 * 1024 * 1024 });

      await expect(service.save(file, 'general')).rejects.toThrow(PayloadTooLargeException);
      expect(mockProvider.uploadFile).not.toHaveBeenCalled();
    });

    it('rejects a MIME type outside the configured allow-list', async () => {
      const file = buildFile({ mimetype: 'application/x-msdownload' });

      await expect(service.save(file, 'general')).rejects.toThrow(UnsupportedMediaTypeException);
      expect(mockProvider.uploadFile).not.toHaveBeenCalled();
    });

    it('fails closed (rejects everything) when STORAGE_ALLOWED_MIME_TYPES resolves to an empty allow-list', async () => {
      const emptyAllowListConfig = {
        get: jest.fn((key: string) => {
          const configMap: Record<string, number | string> = {
            STORAGE_MAX_FILE_SIZE_MB: 1,
            STORAGE_ALLOWED_MIME_TYPES: '',
          };
          return configMap[key];
        }),
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          { provide: STORAGE_IO_TOKEN, useValue: mockProvider },
          { provide: ConfigService, useValue: emptyAllowListConfig },
        ],
      }).compile();
      const emptyAllowListService = module.get<StorageService>(StorageService);
      const file = buildFile();

      await expect(emptyAllowListService.save(file, 'general')).rejects.toThrow(
        UnsupportedMediaTypeException,
      );
      expect(mockProvider.uploadFile).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('delegates deletion to the active provider', async () => {
      await service.remove('general/abc.png');
      expect(mockProvider.deleteFile).toHaveBeenCalledWith('general/abc.png');
    });
  });

  describe('stream', () => {
    it('delegates streaming to the active provider', async () => {
      const fakeStream = {} as NodeJS.ReadableStream;
      mockProvider.getFileStream.mockResolvedValue(fakeStream);

      const result = await service.stream('general/abc.png');

      expect(result).toBe(fakeStream);
      expect(mockProvider.getFileStream).toHaveBeenCalledWith('general/abc.png');
    });
  });
});
