export const NAVIGATION_CACHE_KEY = 'storefront:navigation';

/**
 * Navigation is read on every storefront page render but only changes when
 * the catalog does, so a short TTL keeps the header fresh without putting
 * six aggregate queries on the hot path of every request.
 */
export const NAVIGATION_CACHE_TTL_SECONDS = 300;

/** Products created within this window count as "New Arrivals". */
export const NEW_ARRIVAL_WINDOW_DAYS = 45;

/** Sales window used to rank "Best Sellers" and trending products. */
export const BEST_SELLER_WINDOW_DAYS = 90;

/** Minimum approved average rating (and review count) for "Top Rated". */
export const TOP_RATED_MIN_AVERAGE = 4.3;
export const TOP_RATED_MIN_REVIEWS = 2;

export const TRENDING_PRODUCTS_LIMIT = 6;

export const COLLECTION_KEYS = ['new-arrivals', 'on-sale', 'best-sellers', 'top-rated'] as const;
export type CollectionKey = (typeof COLLECTION_KEYS)[number];
