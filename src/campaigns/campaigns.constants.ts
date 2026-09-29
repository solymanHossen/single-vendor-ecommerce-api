export const CAMPAIGN_STATUSES = ['DRAFT', 'SCHEDULED', 'LIVE', 'ENDED'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/** Keeps a campaign honest: deeper than this is a pricing mistake, not a sale. */
export const MAX_CAMPAIGN_PERCENT = 90;
export const MAX_CAMPAIGN_PRODUCTS = 1000;
export const MAX_CAMPAIGN_CATEGORIES = 100;
/** Products shown with a featured campaign on the homepage. */
export const FEATURED_PRODUCT_COUNT = 8;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "Eid Mega Sale 2026!" → "eid-mega-sale-2026" */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}
