/** Redis key backing the cached singleton {@link AppSettings} row. */
export const SETTINGS_CACHE_KEY = 'app:settings';

/**
 * How long a cached settings snapshot is trusted before the next read falls
 * back to Postgres. Writes (`updateSettings`) refresh the cache immediately,
 * so this only bounds staleness for the rare case another process (a second
 * app instance, a direct DB edit) changes the row without going through the
 * API.
 */
export const SETTINGS_CACHE_TTL_SECONDS = 300;
