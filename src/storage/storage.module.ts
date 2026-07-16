import { Global, Module, UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule, type MulterModuleOptions } from '@nestjs/platform-express';
import { StorageController } from './storage.controller';
import { STORAGE_IO_TOKEN } from './storage.constants';
import { StorageService } from './storage.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';

@Global()
@Module({
  imports: [
    // Memory storage (Multer's default when neither `storage` nor `dest` is set) is required
    // here — both providers read the buffered `file.buffer` rather than a disk path.
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): MulterModuleOptions => {
        const maxSizeMb = configService.get<number>('STORAGE_MAX_FILE_SIZE_MB') ?? 10;
        const allowedMimeTypes = new Set(
          (configService.get<string>('STORAGE_ALLOWED_MIME_TYPES') ?? '')
            .split(',')
            .map((type) => type.trim())
            .filter((type) => type.length > 0),
        );

        return {
          limits: { fileSize: maxSizeMb * 1024 * 1024 },
          // Rejecting a disallowed MIME type here — before the body is fully read — saves
          // bandwidth and memory that StorageService's own check (defense-in-depth) can't.
          // Fails closed: an empty allow-list rejects everything rather than disabling
          // the check (see the matching comment in StorageService.assertValidFile).
          fileFilter: (_request, file, callback) => {
            if (!allowedMimeTypes.has(file.mimetype)) {
              callback(
                new UnsupportedMediaTypeException(`MIME type "${file.mimetype}" is not permitted`),
                false,
              );
              return;
            }
            callback(null, true);
          },
        };
      },
    }),
  ],
  controllers: [StorageController],
  providers: [
    // `new` here (rather than registering both classes as providers) is deliberate: only one
    // implementation is ever active, and S3StorageProvider's constructor requires AWS
    // credentials that legitimately don't exist when STORAGE_PROVIDER=local — eagerly
    // constructing both via the container would crash bootstrap in local mode.
    {
      provide: STORAGE_IO_TOKEN,
      useFactory: (configService: ConfigService): LocalStorageProvider | S3StorageProvider => {
        const provider = configService.get<string>('STORAGE_PROVIDER') ?? 'local';
        return provider === 'cloud'
          ? new S3StorageProvider(configService)
          : new LocalStorageProvider(configService);
      },
      inject: [ConfigService],
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
