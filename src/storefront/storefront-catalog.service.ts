import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  BEST_SELLER_WINDOW_DAYS,
  NEW_ARRIVAL_WINDOW_DAYS,
  TOP_RATED_MIN_AVERAGE,
  TOP_RATED_MIN_REVIEWS,
  type CollectionKey,
} from './storefront.constants';
import type { CatalogQueryDto, CatalogSort } from './dto/catalog-query.dto';
import {
  CatalogAppliedCategoryEntity,
  CatalogCategoryFacetEntity,
  CatalogCategoryRefEntity,
  CatalogFacetsEntity,
  CatalogPageEntity,
  CatalogPageMetaEntity,
  CatalogPriceRangeEntity,
  CatalogProductCardEntity,
  ProductDetailEntity,
  ProductDetailImageEntity,
  ProductDetailVariantEntity,
  ProductOptionGroupEntity,
  ProductOptionValueEntity,
  RatingSummaryEntity,
} from './entities/catalog.entity';

const MS_PER_DAY = 86_400_000;
const MAX_INT4 = 2_147_483_647;
const RELATED_PRODUCTS_LIMIT = 8;

/**
 * ORDER BY clauses per sort key. These are compile-time constants (never
 * user input), so interpolating them with Prisma.raw is injection-safe.
 * Every clause ends in a unique key so pagination is deterministic.
 */
const SORT_SQL: Readonly<Record<CatalogSort, string>> = {
  featured: 'in_stock DESC, units_sold DESC, avg_rating DESC, review_count DESC, id ASC',
  newest: 'created_at DESC, id DESC',
  'price-asc': 'effective_price ASC, id ASC',
  'price-desc': 'effective_price DESC, id ASC',
  rating: 'avg_rating DESC, review_count DESC, id ASC',
  'best-selling': 'units_sold DESC, id ASC',
};

const CARD_SELECT = {
  id: true,
  name: true,
  slug: true,
  basePrice: true,
  discountPrice: true,
  stockQuantity: true,
  createdAt: true,
  category: { select: { name: true, slug: true } },
  images: {
    select: { url: true },
    orderBy: [{ isThumbnail: 'desc' }, { id: 'asc' }],
    take: 2,
  },
  _count: { select: { variants: true } },
} satisfies Prisma.ProductSelect;

const DETAIL_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  basePrice: true,
  discountPrice: true,
  sku: true,
  stockQuantity: true,
  metaTitle: true,
  metaDesc: true,
  createdAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      metaDesc: true,
      parent: { select: { id: true, name: true, slug: true } },
    },
  },
  images: {
    select: { id: true, url: true, isThumbnail: true },
    orderBy: [{ isThumbnail: 'desc' }, { id: 'asc' }],
  },
  variants: {
    select: {
      id: true,
      sku: true,
      price: true,
      stockQuantity: true,
      imageUrl: true,
      options: {
        select: {
          attributeOption: {
            select: {
              id: true,
              value: true,
              attribute: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof CARD_SELECT }>;
type DetailRow = Prisma.ProductGetPayload<{ select: typeof DETAIL_SELECT }>;

interface CategoryNode {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  metaDesc: string | null;
}

interface CatalogFilters {
  categoryIds?: number[];
  search?: string;
  collection?: CollectionKey;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  excludeIds?: number[];
}

interface RankedRow {
  id: number;
  avg_rating: number;
  review_count: number;
}

/** Escapes LIKE wildcards so a shopper typing "50%" searches for a literal "%". */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function roundRating(value: number): number {
  return Math.round(value * 10) / 10;
}

@Injectable()
export class StorefrontCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Listing ────────────────────────────────────────────────────────────────

  async listProducts(query: CatalogQueryDto): Promise<CatalogPageEntity> {
    const categories = await this.loadCategories();

    let applied: CatalogAppliedCategoryEntity | null = null;
    let categoryIds: number[] | undefined;
    if (query.category !== undefined) {
      const node = categories.find((category) => category.slug === query.category);
      if (!node) {
        throw new NotFoundException(`Category "${query.category}" does not exist.`);
      }
      categoryIds = this.subtreeIds(categories, node.id);
      applied = this.toAppliedCategory(categories, node);
    }

    const filters: CatalogFilters = {
      categoryIds,
      search: query.q,
      collection: query.collection,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      inStock: query.inStock,
    };

    // Facets deliberately ignore their own dimension (category counts are
    // computed without the category filter, the price range without the
    // price filter) so the sidebar always shows the options you can switch to.
    const [ranked, total, categoryCounts, priceRange] = await Promise.all([
      this.rankIds(filters, query.sort, query.limit, (query.page - 1) * query.limit),
      this.countMatches(filters),
      this.countByCategory({ ...filters, categoryIds: undefined }),
      this.priceRange({ ...filters, minPrice: undefined, maxPrice: undefined }),
    ]);

    return new CatalogPageEntity({
      items: await this.loadCards(ranked),
      meta: new CatalogPageMetaEntity({
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      }),
      facets: new CatalogFacetsEntity({
        categories: this.buildFacetTree(categories, categoryCounts),
        priceRange,
      }),
      category: applied,
    });
  }

  // ── Detail ─────────────────────────────────────────────────────────────────

  /** Accepts a numeric id or a slug; unpublished products are indistinguishable from missing ones. */
  async getProduct(idOrSlug: string): Promise<ProductDetailEntity> {
    const where = this.detailWhere(idOrSlug);
    const product = where
      ? await this.prisma.product.findFirst({ where, select: DETAIL_SELECT })
      : null;
    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    const bestSellerSince = new Date(Date.now() - BEST_SELLER_WINDOW_DAYS * MS_PER_DAY);
    const [ratingGroups, sold, categories] = await Promise.all([
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { productId: product.id, isApproved: true },
        _count: { _all: true },
      }),
      this.prisma.orderItem.aggregate({
        where: {
          productId: product.id,
          order: {
            status: { notIn: ['CANCELLED', 'RETURNED'] },
            createdAt: { gte: bestSellerSince },
          },
        },
        _sum: { quantity: true },
      }),
      this.loadCategories(),
    ]);

    return new ProductDetailEntity({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      basePrice: product.basePrice.toString(),
      discountPrice: product.discountPrice?.toString() ?? null,
      sku: product.sku,
      stockQuantity: product.stockQuantity,
      metaTitle: product.metaTitle,
      metaDesc: product.metaDesc,
      category: new CatalogAppliedCategoryEntity({
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
        description: product.category.metaDesc,
        parent: product.category.parent
          ? new CatalogCategoryRefEntity(product.category.parent)
          : null,
      }),
      images: product.images.map((image) => new ProductDetailImageEntity(image)),
      optionGroups: this.buildOptionGroups(product),
      variants: product.variants.map(
        (variant) =>
          new ProductDetailVariantEntity({
            id: variant.id,
            sku: variant.sku,
            price: variant.price.toString(),
            stockQuantity: variant.stockQuantity,
            imageUrl: variant.imageUrl,
            optionIds: variant.options.map((option) => option.attributeOption.id),
          }),
      ),
      rating: this.buildRatingSummary(ratingGroups),
      recentlySold: sold._sum.quantity ?? 0,
      related: await this.loadRelated(product, categories),
      createdAt: product.createdAt.toISOString(),
    });
  }

  // ── SQL ranking core ───────────────────────────────────────────────────────

  /**
   * One CTE shared by ranking, counting and faceting. It computes, per
   * published product, the price the shopper pays, recent units sold and the
   * approved-review aggregates — the three things Prisma's query builder
   * cannot sort or filter on directly.
   */
  private catalogCte(): Prisma.Sql {
    const bestSellerSince = new Date(Date.now() - BEST_SELLER_WINDOW_DAYS * MS_PER_DAY);
    return Prisma.sql`
      WITH sales AS (
        SELECT oi.product_id, SUM(oi.quantity)::int AS units_sold
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status NOT IN ('CANCELLED', 'RETURNED') AND o.created_at >= ${bestSellerSince}
        GROUP BY oi.product_id
      ),
      ratings AS (
        SELECT product_id, AVG(rating)::float8 AS avg_rating, COUNT(*)::int AS review_count
        FROM reviews
        WHERE is_approved = true
        GROUP BY product_id
      ),
      catalog AS (
        SELECT
          p.id,
          p.category_id,
          p.name,
          p.sku,
          p.created_at,
          p.discount_price,
          c.name AS category_name,
          COALESCE(p.discount_price, p.base_price) AS effective_price,
          (p.stock_quantity > 0) AS in_stock,
          COALESCE(s.units_sold, 0) AS units_sold,
          COALESCE(r.avg_rating, 0)::float8 AS avg_rating,
          COALESCE(r.review_count, 0) AS review_count
        FROM products p
        JOIN categories c ON c.id = p.category_id
        LEFT JOIN sales s ON s.product_id = p.id
        LEFT JOIN ratings r ON r.product_id = p.id
        WHERE p.is_published = true
      )
    `;
  }

  private whereSql(filters: CatalogFilters): Prisma.Sql {
    const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (filters.categoryIds !== undefined) {
      conditions.push(
        filters.categoryIds.length > 0
          ? Prisma.sql`category_id IN (${Prisma.join(filters.categoryIds)})`
          : Prisma.sql`FALSE`,
      );
    }
    if (filters.excludeIds && filters.excludeIds.length > 0) {
      conditions.push(Prisma.sql`id NOT IN (${Prisma.join(filters.excludeIds)})`);
    }
    if (filters.search !== undefined) {
      const pattern = `%${escapeLike(filters.search)}%`;
      conditions.push(
        Prisma.sql`(name ILIKE ${pattern} OR sku ILIKE ${pattern} OR category_name ILIKE ${pattern})`,
      );
    }
    if (filters.minPrice !== undefined) {
      conditions.push(Prisma.sql`effective_price >= ${filters.minPrice}::numeric`);
    }
    if (filters.maxPrice !== undefined) {
      conditions.push(Prisma.sql`effective_price <= ${filters.maxPrice}::numeric`);
    }
    if (filters.inStock === true) {
      conditions.push(Prisma.sql`in_stock`);
    } else if (filters.inStock === false) {
      conditions.push(Prisma.sql`NOT in_stock`);
    }
    if (filters.collection !== undefined) {
      conditions.push(this.collectionSql(filters.collection));
    }

    return Prisma.join(conditions, ' AND ');
  }

  /** Same definitions the header navigation uses, so counts always agree. */
  private collectionSql(collection: CollectionKey): Prisma.Sql {
    switch (collection) {
      case 'new-arrivals':
        return Prisma.sql`created_at >= ${new Date(Date.now() - NEW_ARRIVAL_WINDOW_DAYS * MS_PER_DAY)}`;
      case 'on-sale':
        return Prisma.sql`discount_price IS NOT NULL`;
      case 'best-sellers':
        return Prisma.sql`units_sold > 0`;
      case 'top-rated':
        return Prisma.sql`avg_rating >= ${TOP_RATED_MIN_AVERAGE} AND review_count >= ${TOP_RATED_MIN_REVIEWS}`;
    }
  }

  private async rankIds(
    filters: CatalogFilters,
    sort: CatalogSort,
    limit: number,
    offset: number,
  ): Promise<RankedRow[]> {
    return this.prisma.$queryRaw<RankedRow[]>(Prisma.sql`
      ${this.catalogCte()}
      SELECT id, avg_rating, review_count
      FROM catalog
      WHERE ${this.whereSql(filters)}
      ORDER BY ${Prisma.raw(SORT_SQL[sort])}
      LIMIT ${limit} OFFSET ${offset}
    `);
  }

  private async countMatches(filters: CatalogFilters): Promise<number> {
    const [row] = await this.prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
      ${this.catalogCte()}
      SELECT COUNT(*)::int AS total FROM catalog WHERE ${this.whereSql(filters)}
    `);
    return row?.total ?? 0;
  }

  private async countByCategory(filters: CatalogFilters): Promise<Map<number, number>> {
    const rows = await this.prisma.$queryRaw<Array<{ category_id: number; total: number }>>(
      Prisma.sql`
        ${this.catalogCte()}
        SELECT category_id, COUNT(*)::int AS total
        FROM catalog
        WHERE ${this.whereSql(filters)}
        GROUP BY category_id
      `,
    );
    return new Map(rows.map((row) => [row.category_id, row.total]));
  }

  private async priceRange(filters: CatalogFilters): Promise<CatalogPriceRangeEntity | null> {
    const [row] = await this.prisma.$queryRaw<Array<{ min: string | null; max: string | null }>>(
      Prisma.sql`
        ${this.catalogCte()}
        SELECT MIN(effective_price)::text AS min, MAX(effective_price)::text AS max
        FROM catalog
        WHERE ${this.whereSql(filters)}
      `,
    );
    return row?.min != null && row.max != null
      ? new CatalogPriceRangeEntity({ min: row.min, max: row.max })
      : null;
  }

  // ── Hydration & shaping ────────────────────────────────────────────────────

  /** Loads card data for a ranked page in ONE query, preserving SQL order. */
  private async loadCards(ranked: RankedRow[]): Promise<CatalogProductCardEntity[]> {
    if (ranked.length === 0) {
      return [];
    }
    const rows = await this.prisma.product.findMany({
      where: { id: { in: ranked.map((row) => row.id) } },
      select: CARD_SELECT,
    });
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const newSince = Date.now() - NEW_ARRIVAL_WINDOW_DAYS * MS_PER_DAY;

    return ranked.flatMap((rank) => {
      const row = rowById.get(rank.id);
      return row ? [this.toCard(row, rank, newSince)] : [];
    });
  }

  private toCard(row: CardRow, rank: RankedRow, newSince: number): CatalogProductCardEntity {
    return new CatalogProductCardEntity({
      id: row.id,
      name: row.name,
      slug: row.slug,
      thumbnailUrl: row.images[0]?.url ?? null,
      hoverImageUrl: row.images[1]?.url ?? null,
      basePrice: row.basePrice.toString(),
      discountPrice: row.discountPrice?.toString() ?? null,
      stockQuantity: row.stockQuantity,
      categoryName: row.category.name,
      categorySlug: row.category.slug,
      ratingAverage: roundRating(Number(rank.avg_rating)),
      reviewCount: Number(rank.review_count),
      variantCount: row._count.variants,
      isNew: row.createdAt.getTime() >= newSince,
    });
  }

  /** Same leaf category first; widens to the parent department if too few. */
  private async loadRelated(
    product: DetailRow,
    categories: CategoryNode[],
  ): Promise<CatalogProductCardEntity[]> {
    const sameCategory = await this.rankIds(
      { categoryIds: [product.category.id], excludeIds: [product.id] },
      'featured',
      RELATED_PRODUCTS_LIMIT,
      0,
    );

    let ranked = sameCategory;
    const parentId = product.category.parent?.id;
    if (ranked.length < RELATED_PRODUCTS_LIMIT && parentId !== undefined) {
      const wider = await this.rankIds(
        {
          categoryIds: this.subtreeIds(categories, parentId),
          excludeIds: [product.id, ...ranked.map((row) => row.id)],
        },
        'featured',
        RELATED_PRODUCTS_LIMIT - ranked.length,
        0,
      );
      ranked = [...ranked, ...wider];
    }

    return this.loadCards(ranked);
  }

  private detailWhere(idOrSlug: string): Prisma.ProductWhereInput | null {
    if (/^\d+$/.test(idOrSlug)) {
      const id = Number(idOrSlug);
      return id > 0 && id <= MAX_INT4 ? { id, isPublished: true } : null;
    }
    return /^[a-z0-9-]{1,200}$/.test(idOrSlug) ? { slug: idOrSlug, isPublished: true } : null;
  }

  /** Groups variant options by attribute, in stable id order, for the picker UI. */
  private buildOptionGroups(product: DetailRow): ProductOptionGroupEntity[] {
    const groups = new Map<number, { name: string; values: Map<number, string> }>();

    for (const variant of product.variants) {
      for (const { attributeOption } of variant.options) {
        const group = groups.get(attributeOption.attribute.id) ?? {
          name: attributeOption.attribute.name,
          values: new Map<number, string>(),
        };
        group.values.set(attributeOption.id, attributeOption.value);
        groups.set(attributeOption.attribute.id, group);
      }
    }

    return [...groups.entries()]
      .sort(([a], [b]) => a - b)
      .map(
        ([attributeId, group]) =>
          new ProductOptionGroupEntity({
            attributeId,
            name: group.name,
            values: [...group.values.entries()]
              .sort(([a], [b]) => a - b)
              .map(([id, value]) => new ProductOptionValueEntity({ id, value })),
          }),
      );
  }

  private buildRatingSummary(
    groups: Array<{ rating: number; _count: { _all: number } }>,
  ): RatingSummaryEntity {
    const distribution: Record<'1' | '2' | '3' | '4' | '5', number> = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    };
    let count = 0;
    let sum = 0;

    for (const group of groups) {
      const key = String(group.rating);
      if (key === '1' || key === '2' || key === '3' || key === '4' || key === '5') {
        distribution[key] += group._count._all;
        count += group._count._all;
        sum += group.rating * group._count._all;
      }
    }

    return new RatingSummaryEntity({
      average: count === 0 ? 0 : roundRating(sum / count),
      count,
      distribution,
    });
  }

  // ── Category tree helpers ──────────────────────────────────────────────────

  private async loadCategories(): Promise<CategoryNode[]> {
    return this.prisma.category.findMany({
      select: { id: true, name: true, slug: true, parentId: true, metaDesc: true },
      orderBy: { name: 'asc' },
    });
  }

  /** The category and every descendant, cycle-safe. */
  private subtreeIds(categories: CategoryNode[], rootId: number): number[] {
    const childrenOf = new Map<number, number[]>();
    for (const category of categories) {
      if (category.parentId !== null) {
        childrenOf.set(category.parentId, [
          ...(childrenOf.get(category.parentId) ?? []),
          category.id,
        ]);
      }
    }

    const ids = new Set<number>();
    const stack = [rootId];
    while (stack.length > 0) {
      const id = stack.pop();
      if (id === undefined || ids.has(id)) {
        continue;
      }
      ids.add(id);
      stack.push(...(childrenOf.get(id) ?? []));
    }
    return [...ids];
  }

  private toAppliedCategory(
    categories: CategoryNode[],
    node: CategoryNode,
  ): CatalogAppliedCategoryEntity {
    const parent = categories.find((category) => category.id === node.parentId);
    return new CatalogAppliedCategoryEntity({
      id: node.id,
      name: node.name,
      slug: node.slug,
      description: node.metaDesc,
      parent: parent
        ? new CatalogCategoryRefEntity({ id: parent.id, name: parent.name, slug: parent.slug })
        : null,
    });
  }

  /** Two-level facet tree with rolled-up counts; zero-count branches pruned. */
  private buildFacetTree(
    categories: CategoryNode[],
    counts: Map<number, number>,
  ): CatalogCategoryFacetEntity[] {
    const byCount = (a: CatalogCategoryFacetEntity, b: CatalogCategoryFacetEntity): number =>
      b.productCount - a.productCount || a.name.localeCompare(b.name);

    const totalFor = (id: number): number =>
      this.subtreeIds(categories, id).reduce((sum, subId) => sum + (counts.get(subId) ?? 0), 0);

    return categories
      .filter((category) => category.parentId === null)
      .map(
        (parent) =>
          new CatalogCategoryFacetEntity({
            id: parent.id,
            name: parent.name,
            slug: parent.slug,
            productCount: totalFor(parent.id),
            children: categories
              .filter((child) => child.parentId === parent.id)
              .map(
                (child) =>
                  new CatalogCategoryFacetEntity({
                    id: child.id,
                    name: child.name,
                    slug: child.slug,
                    productCount: totalFor(child.id),
                    children: [],
                  }),
              )
              .filter((child) => child.productCount > 0)
              .sort(byCount),
          }),
      )
      .filter((parent) => parent.productCount > 0)
      .sort(byCount);
  }
}
