import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { type ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { S3StorageProvider } from './s3-storage.provider';

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

describe('S3StorageProvider', () => {
  let provider: S3StorageProvider;
  let sendSpy: jest.SpiedFunction<typeof S3Client.prototype.send>;

  beforeEach(() => {
    const configService = {
      get: jest.fn((key: string) => {
        const configMap: Record<string, string> = { STORAGE_AWS_REGION: 'us-east-1' };
        return configMap[key];
      }),
      getOrThrow: jest.fn((key: string) => {
        const configMap: Record<string, string> = {
          STORAGE_AWS_ACCESS_KEY_ID: 'key',
          STORAGE_AWS_SECRET_ACCESS_KEY: 'secret',
          STORAGE_AWS_BUCKET_NAME: 'test-bucket',
        };
        return configMap[key];
      }),
    } as unknown as ConfigService;

    provider = new S3StorageProvider(configService);
    sendSpy = jest.spyOn(S3Client.prototype, 'send');
  });

  afterEach(() => {
    sendSpy.mockRestore();
  });

  describe('uploadFile', () => {
    it('puts the object and returns a permanent stream URL keyed by folder/uuid', async () => {
      sendSpy.mockResolvedValue({} as never);

      const result = await provider.uploadFile(buildFile(), 'avatars');

      expect(sendSpy).toHaveBeenCalledWith(expect.any(PutObjectCommand));
      expect(result.key).toMatch(/^avatars\/[0-9a-f-]+\.png$/);
      expect(result.url).toContain(`/api/v1/storage/stream/${result.key}`);
    });

    it('rejects a folder containing path-traversal segments before calling S3', async () => {
      await expect(provider.uploadFile(buildFile(), '../../etc')).rejects.toThrow(
        BadRequestException,
      );
      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('wraps SDK failures in InternalServerErrorException', async () => {
      sendSpy.mockRejectedValue(new Error('network down') as never);

      await expect(provider.uploadFile(buildFile(), 'avatars')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('deleteFile', () => {
    it('sends a DeleteObjectCommand for a well-formed key', async () => {
      sendSpy.mockResolvedValue({} as never);

      await provider.deleteFile('avatars/abc.png');

      expect(sendSpy).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });

    it('rejects a malformed key before calling S3', async () => {
      await expect(provider.deleteFile('../../etc/passwd')).rejects.toThrow(BadRequestException);
      expect(sendSpy).not.toHaveBeenCalled();
    });
  });

  describe('getFileStream', () => {
    it('returns the readable body for a well-formed key', async () => {
      const body = Readable.from([Buffer.from('hi')]);
      sendSpy.mockResolvedValue({ Body: body } as never);

      const result = await provider.getFileStream('avatars/abc.png');

      expect(sendSpy).toHaveBeenCalledWith(expect.any(GetObjectCommand));
      expect(result).toBe(body);
    });

    it('maps a NoSuchKey SDK error to NotFoundException', async () => {
      const notFound = new Error('not found');
      notFound.name = 'NoSuchKey';
      sendSpy.mockRejectedValue(notFound as never);

      await expect(provider.getFileStream('avatars/abc.png')).rejects.toThrow(NotFoundException);
    });

    it('throws InternalServerErrorException when the body is not a Node stream', async () => {
      sendSpy.mockResolvedValue({ Body: undefined } as never);

      await expect(provider.getFileStream('avatars/abc.png')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
