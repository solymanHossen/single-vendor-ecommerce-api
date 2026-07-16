export interface StorageResponse {
  key: string;
  url: string;
  mimeType: string;
  size: number;
}

/**
 * Contract every storage backend (local disk, S3-compatible cloud) must satisfy.
 * `StorageService` depends only on this interface, never on a concrete provider.
 */
export interface IStorageProvider {
  uploadFile(file: Express.Multer.File, folder: string): Promise<StorageResponse>;
  deleteFile(objectKey: string): Promise<void>;
  getFileStream(objectKey: string): Promise<NodeJS.ReadableStream>;
}
