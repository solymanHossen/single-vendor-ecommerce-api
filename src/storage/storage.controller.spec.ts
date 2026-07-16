import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Readable } from 'node:stream';
import type { Response } from 'express';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { StorageEntity } from './entities/storage.entity';

const mockStorageService = {
  save: jest.fn(),
  remove: jest.fn(),
  stream: jest.fn(),
};

function buildFile(): Express.Multer.File {
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
  };
}

// Kept as a plain object (not `jest.Mocked<Response>`) so its properties stay function types
// rather than the "method" shape Express's Response interface declares — the latter trips
// @typescript-eslint/unbound-method on `expect(response.setHeader)` below.
function buildResponse() {
  return {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    end: jest.fn(),
    destroy: jest.fn(),
    headersSent: false,
  };
}

describe('StorageController', () => {
  let controller: StorageController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [{ provide: StorageService, useValue: mockStorageService }],
    }).compile();

    controller = module.get<StorageController>(StorageController);
  });

  describe('uploadFile', () => {
    it('throws BadRequestException when no file is provided', async () => {
      await expect(
        controller.uploadFile(undefined as never, { folder: 'general' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockStorageService.save).not.toHaveBeenCalled();
    });

    it('wraps the service response in a StorageEntity envelope', async () => {
      const file = buildFile();
      const saved = {
        key: 'general/abc.png',
        url: 'http://localhost:3000/api/v1/storage/stream/general/abc.png',
        mimeType: 'image/png',
        size: file.size,
      };
      mockStorageService.save.mockResolvedValue(saved);

      const result = await controller.uploadFile(file, { folder: 'general' });

      expect(mockStorageService.save).toHaveBeenCalledWith(file, 'general');
      expect(result.data).toBeInstanceOf(StorageEntity);
      expect(result.data).toEqual(saved);
    });
  });

  describe('streamFile', () => {
    it('pipes the resolved stream to the response with a resolved Content-Type', async () => {
      const fakeStream = new Readable({ read: () => undefined });
      const pipeSpy = jest.spyOn(fakeStream, 'pipe').mockReturnValue(undefined as never);
      mockStorageService.stream.mockResolvedValue(fakeStream);
      const response = buildResponse();

      await controller.streamFile('general', 'abc.png', response as unknown as Response);

      expect(mockStorageService.stream).toHaveBeenCalledWith('general/abc.png');
      expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
      expect(response.setHeader).toHaveBeenCalledWith(
        'Cross-Origin-Resource-Policy',
        'cross-origin',
      );
      expect(pipeSpy).toHaveBeenCalledWith(response);
    });
  });

  describe('deleteFile', () => {
    it('delegates to the service using the joined object key', async () => {
      const result = await controller.deleteFile('general', 'abc.png');

      expect(mockStorageService.remove).toHaveBeenCalledWith('general/abc.png');
      expect(result).toEqual({ message: 'File deleted successfully', data: null });
    });
  });
});
