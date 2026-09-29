import { DiscountType, Prisma } from '@prisma/client';

/** A live campaign's price rule, as it applies to a product. */
export interface CampaignOffer {
  campaignId: number;
  name: string;
  slug: string;
  discountType: DiscountType;
  discountValue: Prisma.Decimal;
  maxDiscountAmount: Prisma.Decimal | null;
  startsAt: Date;
  endsAt: Date;
}

const ONE = new Prisma.Decimal(1);

/**
 * The campaign price for one unit. Whole taka, rounded down (the shopper
 * never pays a fraction more than the advertised %), never below ৳1.
 * Mirrored in SQL by StorefrontCatalogService.catalogCte — keep them equal.
 */
export function campaignPrice(amount: Prisma.Decimal, offer: CampaignOffer): Prisma.Decimal {
  let discount =
    offer.discountType === DiscountType.PERCENTAGE
      ? amount.times(offer.discountValue).dividedBy(100)
      : offer.discountValue;
  if (offer.maxDiscountAmount !== null && discount.greaterThan(offer.maxDiscountAmount)) {
    discount = offer.maxDiscountAmount;
  }
  const price = amount.minus(discount).toDecimalPlaces(0, Prisma.Decimal.ROUND_FLOOR);
  return Prisma.Decimal.max(price, ONE);
}

/** The offer that gives the lowest price, if any beats `amount`. Best price always wins. */
export function bestOffer(
  amount: Prisma.Decimal,
  offers: readonly CampaignOffer[],
): { price: Prisma.Decimal; offer: CampaignOffer } | null {
  let best: { price: Prisma.Decimal; offer: CampaignOffer } | null = null;
  for (const offer of offers) {
    const price = campaignPrice(amount, offer);
    if (price.lessThan(amount) && (!best || price.lessThan(best.price))) best = { price, offer };
  }
  return best;
}

/**
 * Layers the best live campaign over a regular line price. The "was" price
 * becomes the regular compare-at (or the regular selling price).
 */
export function applyCampaign(
  line: { unitPrice: Prisma.Decimal; compareAtPrice: Prisma.Decimal | null },
  offers: readonly CampaignOffer[] | undefined,
): {
  unitPrice: Prisma.Decimal;
  compareAtPrice: Prisma.Decimal | null;
  offer: CampaignOffer | null;
} {
  const best = offers && offers.length > 0 ? bestOffer(line.unitPrice, offers) : null;
  if (!best) return { ...line, offer: null };
  return {
    unitPrice: best.price,
    compareAtPrice: line.compareAtPrice ?? line.unitPrice,
    offer: best.offer,
  };
}

/** "20% off" / "৳500 off" — for badges and API consumers. */
export function offerLabel(offer: Pick<CampaignOffer, 'discountType' | 'discountValue'>): string {
  return offer.discountType === DiscountType.PERCENTAGE
    ? `${offer.discountValue.toString()}% off`
    : `৳${Number(offer.discountValue.toString()).toLocaleString('en-US')} off`;
}
