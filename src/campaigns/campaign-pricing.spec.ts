import { Prisma } from '@prisma/client';
import {
  applyCampaign,
  bestOffer,
  campaignPrice,
  offerLabel,
  type CampaignOffer,
} from './campaign-pricing';
import { CampaignPricingService } from './campaign-pricing.service';

const D = (value: number | string) => new Prisma.Decimal(value);

const offer = (overrides: Partial<CampaignOffer> = {}): CampaignOffer => ({
  campaignId: 1,
  name: 'Eid Sale',
  slug: 'eid-sale',
  discountType: 'PERCENTAGE',
  discountValue: D(20),
  maxDiscountAmount: null,
  startsAt: new Date('2026-09-01T00:00:00Z'),
  endsAt: new Date('2026-10-01T00:00:00Z'),
  ...overrides,
});

describe('campaign price maths', () => {
  it('takes a percentage off, rounding down to whole taka', () => {
    expect(campaignPrice(D(1999), offer())).toEqual(D(1599)); // 1599.2 → 1599
  });

  it('caps a percentage discount', () => {
    expect(campaignPrice(D(10000), offer({ maxDiscountAmount: D(500) }))).toEqual(D(9500));
  });

  it('takes a fixed amount off and never goes below ৳1', () => {
    expect(
      campaignPrice(D(1200), offer({ discountType: 'FIXED_AMOUNT', discountValue: D(300) })),
    ).toEqual(D(900));
    expect(
      campaignPrice(D(200), offer({ discountType: 'FIXED_AMOUNT', discountValue: D(500) })),
    ).toEqual(D(1));
  });

  it('picks the offer with the lowest price', () => {
    const best = bestOffer(D(1000), [
      offer({ campaignId: 1, discountValue: D(10) }),
      offer({ campaignId: 2, discountType: 'FIXED_AMOUNT', discountValue: D(250) }),
    ]);
    expect(best?.offer.campaignId).toBe(2);
    expect(best?.price).toEqual(D(750));
  });

  it('never stacks: the campaign comes off the regular price, not the sale price', () => {
    // 10% product sale + 20% campaign = 20% off (800), not 28% off (720).
    expect(applyCampaign({ unitPrice: D(900), compareAtPrice: D(1000) }, [offer()])).toMatchObject({
      unitPrice: D(800),
      compareAtPrice: D(1000),
    });
  });

  it('keeps a product sale that beats the campaign, without the campaign badge', () => {
    // 70% product sale vs 50% campaign: the shopper keeps 70% off.
    expect(
      applyCampaign({ unitPrice: D(300), compareAtPrice: D(1000) }, [
        offer({ discountValue: D(50) }),
      ]),
    ).toEqual({ unitPrice: D(300), compareAtPrice: D(1000), offer: null });
    // Equal prices: nothing to gain, the product sale stands.
    expect(
      applyCampaign({ unitPrice: D(500), compareAtPrice: D(1000) }, [
        offer({ discountValue: D(50) }),
      ]).offer,
    ).toBeNull();
  });

  it('falls back to the selling price as the "was" price', () => {
    expect(applyCampaign({ unitPrice: D(900), compareAtPrice: null }, [offer()])).toMatchObject({
      compareAtPrice: D(900),
    });
    expect(applyCampaign({ unitPrice: D(900), compareAtPrice: null }, undefined)).toMatchObject({
      unitPrice: D(900),
      offer: null,
    });
  });

  it('labels offers for badges', () => {
    expect(offerLabel(offer())).toBe('20% off');
    expect(offerLabel(offer({ discountType: 'FIXED_AMOUNT', discountValue: D(1500) }))).toBe(
      '৳1,500 off',
    );
  });
});

describe('CampaignPricingService', () => {
  const prisma = {
    campaign: { findMany: jest.fn(), findUnique: jest.fn() },
    category: { findMany: jest.fn() },
    product: { findMany: jest.fn() },
  };
  const now = new Date('2026-09-15T00:00:00Z');
  let service: CampaignPricingService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new CampaignPricingService(prisma as never);
    prisma.category.findMany.mockResolvedValue([
      { id: 1, parentId: null },
      { id: 2, parentId: 1 },
      { id: 3, parentId: 2 },
      { id: 9, parentId: null },
    ]);
    prisma.campaign.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Eid Sale',
        slug: 'eid-sale',
        discountType: 'PERCENTAGE',
        discountValue: D(20),
        maxDiscountAmount: null,
        startsAt: new Date('2026-09-01'),
        endsAt: new Date('2026-10-01'),
        products: [{ productId: 50 }],
        categories: [{ categoryId: 1 }],
      },
      {
        id: 2,
        name: 'Later',
        slug: 'later',
        discountType: 'PERCENTAGE',
        discountValue: D(50),
        maxDiscountAmount: null,
        startsAt: new Date('2026-12-01'),
        endsAt: new Date('2026-12-31'),
        products: [{ productId: 60 }],
        categories: [],
      },
    ]);
  });

  it('matches chosen products and every sub-category, only while live', async () => {
    const offers = await service.offersFor(
      [
        { id: 50, categoryId: 9 },
        { id: 51, categoryId: 3 }, // grandchild of category 1
        { id: 52, categoryId: 9 },
        { id: 60, categoryId: 9 }, // only in the scheduled campaign
      ],
      now,
    );
    expect([...offers.keys()]).toEqual([50, 51]);
  });

  it('caches rules and reloads after invalidate()', async () => {
    await service.offersFor([{ id: 50, categoryId: 9 }], now);
    await service.offersFor([{ id: 50, categoryId: 9 }], now);
    expect(prisma.campaign.findMany).toHaveBeenCalledTimes(1);
    service.invalidate();
    await service.offersFor([{ id: 50, categoryId: 9 }], now);
    expect(prisma.campaign.findMany).toHaveBeenCalledTimes(2);
  });
});
