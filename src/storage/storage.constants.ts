/** DI token for the active {@link IStorageProvider} implementation (local disk or S3-compatible cloud). */
export const STORAGE_IO_TOKEN = 'STORAGE_IO_PROVIDER_TOKEN';

/**
 * Every stored object key has the flat shape `<folder>/<generatedFileName>` — exactly one
 * segment deep, enforced at write time by both providers. This lets the streaming/delete
 * routes accept `:folder/:filename` path params instead of a greedy wildcard matcher.
 */
export const SAFE_FOLDER_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
export const SAFE_FILENAME_PATTERN = /^[a-zA-Z0-9_.-]{1,255}$/;

export const DEFAULT_STORAGE_FOLDER = 'general';
