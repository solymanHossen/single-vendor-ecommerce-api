/** Guest cart requests identify themselves via this header instead of a Bearer token. */
export const SESSION_ID_HEADER = 'x-session-id';

/** Idle carts (guest or user) expire after 30 days of inactivity rather than accumulating in Redis forever. */
export const CART_TTL_SECONDS = 60 * 60 * 24 * 30;

/** Sane upper bound on a single line item's quantity, independent of actual stock. */
export const MAX_CART_ITEM_QUANTITY = 100;

/**
 * Redis hash field for one cart line: `<productId>` for a simple product,
 * `<productId>:<variantId>` for a variant. The same product can therefore
 * sit in the cart once per variant.
 */
export const CART_LINE_KEY_PATTERN = /^(\d+)(?::(\d+))?$/;

export function cartLineKey(productId: number, variantId: number | null): string {
  return variantId === null ? String(productId) : `${productId}:${variantId}`;
}

export function parseCartLineKey(
  key: string,
): { productId: number; variantId: number | null } | null {
  const match = CART_LINE_KEY_PATTERN.exec(key);
  if (!match?.[1]) return null;
  return { productId: Number(match[1]), variantId: match[2] ? Number(match[2]) : null };
}
