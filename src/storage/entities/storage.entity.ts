import { ApiProperty } from '@nestjs/swagger';

export class StorageEntity {
  @ApiProperty({
    example: 'avatars/8f7b2c1a-4d3e-2b1a-0c9b-8a7f6e5d4c3b.png',
    description: 'Unique object storage key, shaped as `<folder>/<generatedFileName>`',
  })
  key: string;

  @ApiProperty({
    example: 'https://api.example.com/api/v1/storage/stream/avatars/8f7b2c1a.png',
    description: 'Permanent, provider-agnostic URL for reading the stored object back',
  })
  url: string;

  @ApiProperty({ example: 'image/png', description: 'MIME type of the uploaded asset' })
  mimeType: string;

  @ApiProperty({ example: 1048576, description: 'File size in bytes' })
  size: number;

  constructor(partial: StorageEntity) {
    this.key = partial.key;
    this.url = partial.url;
    this.mimeType = partial.mimeType;
    this.size = partial.size;
  }
}
