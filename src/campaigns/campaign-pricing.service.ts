import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { applyCampaign, type CampaignOffer } from './campaign-pricing';

interface CachedCampaign extends CampaignOffer {
  productIds: ReadonlySet<number>;
  /** The chosen categories plus all their sub-categories. */
  categoryIds: ReadonlySet<number>;
}

/** Live pricing rules change only on admin edits; everything else re-checks the clock. */
const CACHE_TTL_MS = 30_000;

/**
 * The single source of campaign prices for cart, checkout, the storefront
 * and the wishlist. Campaigns that haven't ended are cached briefly (the
 * table is tiny); whether one is live is decided against the clock on every
 * call, so a sale starts and stops exactly on time.
 */
@Injectable()
export class CampaignPricingService {
  private cache: { at: number; campaigns: CachedCampaign[] } | null = null;
  private loading: Promise<CachedCampaign[]> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Call after any campaign write so this instance prices from fresh rules. */
  invalidate(): void {
    this.cache = null;
  }

  /** Live offers per product id (only products with at least one). */
  async offersFor(
    products: ReadonlyArray<{ id: number; categoryId: number }>,
    now: Date = new Date(),
  ): Promise<Map<number, CampaignOffer[]>> {
    const live = (await this.campaigns()).filter(
      (campaign) => campaign.startsAt <= now && campaign.endsAt > now,
    );
    const result = new Map<number, CampaignOffer[]>();
    if (live.length === 0) return result;
    for (const product of products) {
      const offers = live.filter(
        (campaign) =>
          campaign.productIds.has(product.id) || campaign.categoryIds.has(product.categoryId),
      );
      if (offers.length > 0) result.set(product.id, offers);
    }
    return result;
  }

  /** Convenience for one line: regular price → campaign-aware price. */
  async price(
    product: { id: number; categoryId: number },
    line: { unitPrice: Prisma.Decimal; compareAtPrice: Prisma.Decimal | null },
  ): Promise<ReturnType<typeof applyCampaign>> {
    const offers = await this.offersFor([product]);
    return applyCampaign(line, offers.get(product.id));
  }

  /** Every published product a campaign covers — for its landing page. */
  async productIdsFor(campaignId: number): Promise<number[]> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        products: { select: { productId: true } },
        categories: { select: { categoryId: true } },
      },
    });
    if (!campaign) return [];
    const categoryIds = await this.expandCategories(campaign.categories.map((c) => c.categoryId));
    const rows = await this.prisma.product.findMany({
      where: {
        isPublished: true,
        OR: [
          { id: { in: campaign.products.map((p) => p.productId) } },
          ...(categoryIds.size > 0 ? [{ categoryId: { in: [...categoryIds] } }] : []),
        ],
      },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  private async campaigns(): Promise<CachedCampaign[]> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) return this.cache.campaigns;
    // One load at a time, however many requests arrive together.
    this.loading ??= this.load().finally(() => (this.loading = null));
    return this.loading;
  }

  private async load(): Promise<CachedCampaign[]> {
    const rows = await this.prisma.campaign.findMany({
      where: { isActive: true, endsAt: { gt: new Date() } },
      select: {
        id: true,
        name: true,
        slug: true,
        discountType: true,
        discountValue: true,
        maxDiscountAmount: true,
        startsAt: true,
        endsAt: true,
        products: { select: { productId: true } },
        categories: { select: { categoryId: true } },
      },
    });
    const campaigns = await Promise.all(
      rows.map(async (row) => ({
        campaignId: row.id,
        name: row.name,
        slug: row.slug,
        discountType: row.discountType,
        discountValue: row.discountValue,
        maxDiscountAmount: row.maxDiscountAmount,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        productIds: new Set(row.products.map((p) => p.productId)),
        categoryIds: await this.expandCategories(row.categories.map((c) => c.categoryId)),
      })),
    );
    this.cache = { at: Date.now(), campaigns };
    return campaigns;
  }

  private async expandCategories(roots: number[]): Promise<Set<number>> {
    const ids = new Set(roots);
    if (roots.length === 0) return ids;
    const all = await this.prisma.category.findMany({ select: { id: true, parentId: true } });
    let grew = true;
    while (grew) {
      grew = false;
      for (const category of all) {
        if (category.parentId !== null && ids.has(category.parentId) && !ids.has(category.id)) {
          ids.add(category.id);
          grew = true;
        }
      }
    }
    return ids;
  }
}
