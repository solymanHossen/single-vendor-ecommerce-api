export const REVIEW_SORTS = ['recent', 'helpful', 'highest', 'lowest'] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

export const REVIEW_STATUSES = ['PENDING', 'PUBLISHED', 'HIDDEN'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Why a shopper can't write a review (yet). */
export type ReviewBlocker = 'NOT_PURCHASED' | 'NOT_DELIVERED' | 'ALREADY_REVIEWED';

export const MAX_REVIEW_IMAGES = 5;

/** "Nusrat Jahan" → "Nusrat J." — enough to feel human, not enough to dox. */
export function displayName(name: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Customer';
  const [first, ...rest] = parts;
  const last = rest.at(-1);
  return last ? `${first} ${last[0]!.toUpperCase()}.` : first!;
}
