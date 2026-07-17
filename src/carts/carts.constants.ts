/** Guest cart requests identify themselves via this header instead of a Bearer token. */
export const SESSION_ID_HEADER = 'x-session-id';

/** Idle carts (guest or user) expire after 30 days of inactivity rather than accumulating in Redis forever. */
export const CART_TTL_SECONDS = 60 * 60 * 24 * 30;

/** Sane upper bound on a single line item's quantity, independent of actual stock. */
export const MAX_CART_ITEM_QUANTITY = 100;
