import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import {
  BEST_SELLER_WINDOW_DAYS,
  NAVIGATION_CACHE_KEY,
  NAVIGATION_CACHE_TTL_SECONDS,
  NEW_ARRIVAL_WINDOW_DAYS,
  TOP_RATED_MIN_AVERAGE,
  TOP_RATED_MIN_REVIEWS,
  TRENDING_PRODUCTS_LIMIT,
  type CollectionKey,
} from './storefront.constants';
import {
  NavigationCategoryChildEntity,
  NavigationCategoryEntity,
  NavigationCollectionEntity,
  NavigationEntity,
  NavigationProductEntity,
  NavigationPromotionEntity,
} from './entities/navigation.entity';

const MS_PER_DAY = 86_400_000;

const NAV_CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
  iconUrl: true,
  parentId: true,
  metaDesc: true,
  _count: { select: { products: { where: { isPublished: true } } } },
} satisfies Prisma.CategorySelect;

const NAV_PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  basePrice: true,
  discountPrice: true,
  metaDesc: true,
  category: { select: { name: true, slug: true } },
  images: {
    select: { url: true },
    orderBy: [{ isThumbnail: 'desc' }, { id: 'asc' }],
    take: 1,
  },
} satisfies Prisma.ProductSelect;

type NavCategoryRow = Prisma.CategoryGetPayload<{ select: typeof NAV_CATEGORY_SELECT }>;
type NavProductRow = Prisma.ProductGetPayload<{ select: typeof NAV_PRODUCT_SELECT }>;

/** Orders in these states never became sales, so they don't rank "Best Sellers". */
const NON_SALE_STATUSES: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.RETURNED];

const COLLECTION_COPY: Readonly<Record<CollectionKey, { title: string; description: string }>> = {
  'new-arrivals': {
    title: 'New Arrivals',
    description: 'The latest drops, fresh in this season.',
  },
  'on-sale': {
    title: 'On Sale',
    description: 'Limited-time price drops across the store.',
  },
  'best-sellers': {
    title: 'Best Sellers',
    description: 'What customers are buying most right now.',
  },
  'top-rated': {
    title: 'Top Rated',
    description: 'Loved by verified buyers — rated 4.3★ and up.',
  },
};

@Injectable()
export class StorefrontService {
  private readonly logger = new Logger(StorefrontService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Everything the storefront header needs — category tree with live product
   * counts, curated collections, a spotlight deal, trending products and the
   * current promotion — in ONE cached round trip, instead of the client
   * stitching together half a dozen endpoints on every page render.
   */
  async getNavigation(): Promise<NavigationEntity> {
    const cached = await this.readCache();
    if (cached) {
      return cached;
    }

    const navigation = await this.buildNavigation();
    await this.writeCache(navigation);
    return navigation;
  }

  /** Drops the cached payload so the next request rebuilds it from the database. */
  async invalidateNavigation(): Promise<void> {
    try {
      await this.redis.client.del(NAVIGATION_CACHE_KEY);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Navigation cache invalidation failed: ${message}`);
    }
  }

  private async buildNavigation(): Promise<NavigationEntity> {
    const now = new Date();
    const newArrivalSince = new Date(now.getTime() - NEW_ARRIVAL_WINDOW_DAYS * MS_PER_DAY);
    const bestSellerSince = new Date(now.getTime() - BEST_SELLER_WINDOW_DAYS * MS_PER_DAY);

    // Round 1 — every aggregate is independent, so they run concurrently.
    const [
      categoryRows,
      newArrivalCount,
      onSaleCount,
      bestSellerGroups,
      topRatedGroups,
      spotlightRows,
      newestProduct,
      coupons,
    ] = await Promise.all([
      this.prisma.category.findMany({ select: NAV_CATEGORY_SELECT, orderBy: { name: 'asc' } }),
      this.prisma.product.count({
        where: { isPublished: true, createdAt: { gte: newArrivalSince } },
      }),
      this.prisma.product.count({ where: { isPublished: true, discountPrice: { not: null } } }),
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          product: { isPublished: true },
          order: { status: { notIn: NON_SALE_STATUSES }, createdAt: { gte: bestSellerSince } },
        },
        _sum: { quantity: true },
        orderBy: [{ _sum: { quantity: 'desc' } }, { productId: 'asc' }],
      }),
      this.prisma.review.groupBy({
        by: ['productId'],
        where: { isApproved: true, product: { isPublished: true } },
        _avg: { rating: true },
        having: {
          rating: {
            _avg: { gte: TOP_RATED_MIN_AVERAGE },
            _count: { gte: TOP_RATED_MIN_REVIEWS },
          },
        },
        orderBy: [{ _avg: { rating: 'desc' } }, { productId: 'asc' }],
      }),
      // Prisma can't ORDER BY a computed column (base − discount), so the
      // single spotlight id is picked in SQL; details are loaded in round 2.
      this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
        SELECT id FROM products
        WHERE is_published = true
          AND stock_quantity > 0
          AND discount_price IS NOT NULL
        ORDER BY (base_price - discount_price) DESC, id ASC
        LIMIT 1
      `),
      this.prisma.product.findFirst({
        where: { isPublished: true },
        select: { id: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.coupon.findMany({
        where: { isActive: true, validFrom: { lte: now }, validUntil: { gte: now } },
        select: {
          code: true,
          discountType: true,
          discountValue: true,
          minOrderAmount: true,
          maxDiscountAmount: true,
          validUntil: true,
          usageLimit: true,
          usedCount: true,
        },
        orderBy: [{ validUntil: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const trendingIds = bestSellerGroups
      .slice(0, TRENDING_PRODUCTS_LIMIT)
      .map((group) => group.productId);
    const spotlightId = spotlightRows[0]?.id ?? null;
    const topRatedId = topRatedGroups[0]?.productId ?? null;
    const newestId = newestProduct?.id ?? null;

    // Round 2 — one batched lookup for every product card the payload shows.
    const productIds = [
      ...new Set(
        [...trendingIds, spotlightId, topRatedId, newestId].filter(
          (id): id is number => id !== null,
        ),
      ),
    ];
    const productRows =
      productIds.length > 0
        ? await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: NAV_PRODUCT_SELECT,
          })
        : [];
    const productById = new Map(productRows.map((row) => [row.id, this.toProduct(row)]));
    const productFor = (id: number | null): NavigationProductEntity | null =>
      id === null ? null : (productById.get(id) ?? null);

    const spotlight = productFor(spotlightId);
    const trending = trendingIds
      .map((id) => productById.get(id))
      .filter((product): product is NavigationProductEntity => product !== undefined);

    const collections = [
      this.toCollection('new-arrivals', newArrivalCount, productFor(newestId)),
      this.toCollection('on-sale', onSaleCount, spotlight),
      this.toCollection('best-sellers', bestSellerGroups.length, trending[0] ?? null),
      this.toCollection('top-rated', topRatedGroups.length, productFor(topRatedId)),
    ].filter((collection) => collection.productCount > 0);

    // A capped coupon that has been fully redeemed is no longer promotable.
    // Column-to-column comparison isn't expressible in a Prisma `where`, and
    // the active-coupon set is tiny, so this filter runs in memory.
    const promotableCoupon = coupons.find(
      (coupon) => coupon.usageLimit === null || coupon.usedCount < coupon.usageLimit,
    );

    return new NavigationEntity({
      categories: this.buildCategoryTree(categoryRows),
      collections,
      spotlight,
      trending,
      promotion: promotableCoupon
        ? new NavigationPromotionEntity({
            code: promotableCoupon.code,
            discountType: promotableCoupon.discountType,
            discountValue: promotableCoupon.discountValue.toString(),
            minOrderAmount: promotableCoupon.minOrderAmount?.toString() ?? null,
            maxDiscountAmount: promotableCoupon.maxDiscountAmount?.toString() ?? null,
            validUntil: promotableCoupon.validUntil.toISOString(),
          })
        : null,
      generatedAt: now.toISOString(),
    });
  }

  /**
   * Builds the two-level navigation tree from one flat query. Product counts
   * roll up through any depth, so a parent's count covers its whole subtree;
   * empty branches are pruned so the menu never links to a dead end.
   */
  private buildCategoryTree(rows: NavCategoryRow[]): NavigationCategoryEntity[] {
    const childrenByParent = new Map<number, NavCategoryRow[]>();
    for (const row of rows) {
      if (row.parentId !== null) {
        const siblings = childrenByParent.get(row.parentId) ?? [];
        siblings.push(row);
        childrenByParent.set(row.parentId, siblings);
      }
    }

    const totals = new Map<number, number>();
    const totalFor = (row: NavCategoryRow, ancestry: ReadonlySet<number>): number => {
      const memo = totals.get(row.id);
      if (memo !== undefined) {
        return memo;
      }
      // Guards against a malformed parent cycle recursing forever.
      if (ancestry.has(row.id)) {
        return 0;
      }
      const nextAncestry = new Set(ancestry).add(row.id);
      const total = (childrenByParent.get(row.id) ?? []).reduce(
        (sum, child) => sum + totalFor(child, nextAncestry),
        row._count.products,
      );
      totals.set(row.id, total);
      return total;
    };

    const byCountThenName = (a: { productCount: number; name: string }, b: typeof a): number =>
      b.productCount - a.productCount || a.name.localeCompare(b.name);

    return rows
      .filter((row) => row.parentId === null)
      .map(
        (row) =>
          new NavigationCategoryEntity({
            id: row.id,
            name: row.name,
            slug: row.slug,
            iconUrl: row.iconUrl,
            description: row.metaDesc,
            productCount: totalFor(row, new Set()),
            children: (childrenByParent.get(row.id) ?? [])
              .map(
                (child) =>
                  new NavigationCategoryChildEntity({
                    id: child.id,
                    name: child.name,
                    slug: child.slug,
                    iconUrl: child.iconUrl,
                    productCount: totalFor(child, new Set([row.id])),
                  }),
              )
              .filter((child) => child.productCount > 0)
              .sort(byCountThenName),
          }),
      )
      .filter((category) => category.productCount > 0)
      .sort(byCountThenName);
  }

  private toCollection(
    key: CollectionKey,
    productCount: number,
    preview: NavigationProductEntity | null,
  ): NavigationCollectionEntity {
    return new NavigationCollectionEntity({
      key,
      ...COLLECTION_COPY[key],
      productCount,
      previewImageUrl: preview?.thumbnailUrl ?? null,
    });
  }

  private toProduct(row: NavProductRow): NavigationProductEntity {
    return new NavigationProductEntity({
      id: row.id,
      name: row.name,
      slug: row.slug,
      thumbnailUrl: row.images[0]?.url ?? null,
      basePrice: row.basePrice.toString(),
      discountPrice: row.discountPrice?.toString() ?? null,
      categoryName: row.category.name,
      categorySlug: row.category.slug,
      summary: row.metaDesc,
    });
  }

  private async readCache(): Promise<NavigationEntity | null> {
    try {
      const cached = await this.redis.client.get(NAVIGATION_CACHE_KEY);
      return cached ? (JSON.parse(cached) as NavigationEntity) : null;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Navigation cache read failed, falling back to database: ${message}`);
      return null;
    }
  }

  private async writeCache(navigation: NavigationEntity): Promise<void> {
    try {
      await this.redis.client.set(
        NAVIGATION_CACHE_KEY,
        JSON.stringify(navigation),
        'EX',
        NAVIGATION_CACHE_TTL_SECONDS,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Navigation cache write failed: ${message}`);
    }
  }
}
