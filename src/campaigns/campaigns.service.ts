import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DiscountType, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { StorefrontCatalogService } from '../storefront/storefront-catalog.service';
import type { CatalogQueryDto } from '../storefront/dto/catalog-query.dto';
import type { CatalogPageEntity } from '../storefront/entities/catalog.entity';
import { CampaignPricingService } from './campaign-pricing.service';
import { applyCampaign, offerLabel, type CampaignOffer } from './campaign-pricing';
import { linePrice } from '../carts/cart-pricing';
import {
  CAMPAIGN_STATUSES,
  FEATURED_PRODUCT_COUNT,
  MAX_CAMPAIGN_PERCENT,
  slugify,
  type CampaignStatus,
} from './campaigns.constants';
import type {
  AdminCampaignQueryDto,
  CreateCampaignDto,
  UpdateCampaignDto,
} from './dto/campaign.dto';
import {
  CampaignDetailEntity,
  CampaignEntity,
  CampaignProductEntity,
  CampaignStatsEntity,
  FeaturedCampaignEntity,
  PaginatedCampaignsEntity,
  PublicCampaignEntity,
} from './entities/campaign.entity';

const CAMPAIGN_SELECT = {
  id: true,
  name: true,
  slug: true,
  tagline: true,
  description: true,
  discountType: true,
  discountValue: true,
  maxDiscountAmount: true,
  startsAt: true,
  endsAt: true,
  isActive: true,
  isFeatured: true,
  bannerUrl: true,
  accentColor: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { products: true, categories: true } },
} satisfies Prisma.CampaignSelect;

type CampaignRow = Prisma.CampaignGetPayload<{ select: typeof CAMPAIGN_SELECT }>;

/** The fields the rules look at, in stored shape. */
interface CampaignRules {
  discountType: DiscountType;
  discountValue: Prisma.Decimal;
  maxDiscountAmount: Prisma.Decimal | null;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
}

const ZERO = new Prisma.Decimal(0);
const NO_STATS = new CampaignStatsEntity({ orders: 0, units: 0, revenue: ZERO });

export interface AuditContext {
  actor: AuthUser;
  ip: string | null;
}

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: CampaignPricingService,
    private readonly catalog: StorefrontCatalogService,
    private readonly audit: AuditService,
  ) {}

  // ── Admin reads ───────────────────────────────────────────────────────────

  async findAll(query: AdminCampaignQueryDto, now = new Date()): Promise<PaginatedCampaignsEntity> {
    const where: Prisma.CampaignWhereInput = {
      ...(query.status !== 'ALL' && this.statusWhere(query.status, now)),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { slug: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [rows, total, counts] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        select: CAMPAIGN_SELECT,
        // Soonest-ending first among live ones reads naturally everywhere.
        orderBy: [{ endsAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.campaign.count({ where }),
      this.prisma.$transaction(
        CAMPAIGN_STATUSES.map((status) =>
          this.prisma.campaign.count({ where: this.statusWhere(status, now) }),
        ),
      ),
    ]);
    const stats = await this.statsFor(rows.map((row) => row.id));

    return new PaginatedCampaignsEntity({
      items: rows.map((row) => this.toEntity(row, stats.get(row.id), now)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      },
      counts: {
        ...(Object.fromEntries(CAMPAIGN_STATUSES.map((status, i) => [status, counts[i]])) as Record<
          CampaignStatus,
          number
        >),
        ALL: counts.reduce((sum, n) => sum + n, 0),
      },
    });
  }

  async findOne(id: number, now = new Date()): Promise<CampaignDetailEntity> {
    const row = await this.prisma.campaign.findUnique({
      where: { id },
      select: {
        ...CAMPAIGN_SELECT,
        products: {
          select: {
            product: {
              select: {
                id: true,
                name: true,
                basePrice: true,
                discountPrice: true,
                stockQuantity: true,
                isPublished: true,
                images: {
                  select: { url: true },
                  orderBy: [{ isThumbnail: 'desc' }, { id: 'asc' }],
                  take: 1,
                },
              },
            },
          },
          orderBy: { product: { name: 'asc' } },
        },
        categories: {
          select: {
            category: {
              select: {
                id: true,
                name: true,
                _count: { select: { products: { where: { isPublished: true } } } },
              },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Campaign does not exist.');

    const [stats, covered] = await Promise.all([
      this.statsFor([id]),
      this.pricing.productIdsFor(id),
    ]);
    const offer = this.offerOf(row);

    return new CampaignDetailEntity({
      ...this.toEntity(row, stats.get(id), now),
      products: row.products.map(({ product }) => {
        const regular = linePrice(product, null);
        return new CampaignProductEntity({
          id: product.id,
          name: product.name,
          imageUrl: product.images[0]?.url ?? null,
          basePrice: product.basePrice,
          price: regular.unitPrice,
          // What shoppers will pay: the better of the product's own sale and this campaign.
          campaignPrice: applyCampaign(regular, [offer]).unitPrice,
          stockQuantity: product.stockQuantity,
          isPublished: product.isPublished,
        });
      }),
      categories: row.categories.map(({ category }) => ({
        id: category.id,
        name: category.name,
        productCount: category._count.products,
      })),
      coveredProductCount: covered.length,
    });
  }

  // ── Admin writes ──────────────────────────────────────────────────────────

  async create(dto: CreateCampaignDto, ctx?: AuditContext): Promise<CampaignDetailEntity> {
    const rules = this.normalize({
      discountType: dto.discountType,
      discountValue: new Prisma.Decimal(dto.discountValue),
      maxDiscountAmount: dto.maxDiscountAmount ? new Prisma.Decimal(dto.maxDiscountAmount) : null,
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      isActive: dto.isActive,
    });
    await this.assertCoherent(rules, dto.productIds, dto.categoryIds);
    const slug = await this.resolveSlug(dto.slug, dto.name, null);

    const campaign = await this.prisma.campaign.create({
      data: {
        name: dto.name,
        slug,
        tagline: dto.tagline || null,
        description: dto.description || null,
        ...rules,
        isFeatured: dto.isFeatured,
        bannerUrl: dto.bannerUrl ?? null,
        accentColor: dto.accentColor ?? null,
        products: { create: [...new Set(dto.productIds)].map((productId) => ({ productId })) },
        categories: { create: [...new Set(dto.categoryIds)].map((categoryId) => ({ categoryId })) },
      },
      select: { id: true, name: true },
    });
    this.pricing.invalidate();

    if (ctx) {
      await this.audit.record({
        actor: ctx.actor,
        action: 'campaign.created',
        targetType: 'campaign',
        targetId: campaign.id,
        summary: `Created campaign “${campaign.name}” (${offerLabel(rules)})`,
        ipAddress: ctx.ip,
      });
    }
    return this.findOne(campaign.id);
  }

  async update(
    id: number,
    dto: UpdateCampaignDto,
    ctx?: AuditContext,
  ): Promise<CampaignDetailEntity> {
    const current = await this.prisma.campaign.findUnique({
      where: { id },
      select: {
        ...CAMPAIGN_SELECT,
        products: { select: { productId: true } },
        categories: { select: { categoryId: true } },
      },
    });
    if (!current) throw new NotFoundException('Campaign does not exist.');

    const rules = this.normalize({
      discountType: dto.discountType ?? current.discountType,
      discountValue:
        dto.discountValue !== undefined
          ? new Prisma.Decimal(dto.discountValue)
          : current.discountValue,
      maxDiscountAmount:
        dto.maxDiscountAmount === undefined
          ? current.maxDiscountAmount
          : dto.maxDiscountAmount === null
            ? null
            : new Prisma.Decimal(dto.maxDiscountAmount),
      startsAt: dto.startsAt ? new Date(dto.startsAt) : current.startsAt,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : current.endsAt,
      isActive: dto.isActive ?? current.isActive,
    });
    const productIds = dto.productIds ?? current.products.map((p) => p.productId);
    const categoryIds = dto.categoryIds ?? current.categories.map((c) => c.categoryId);
    await this.assertCoherent(rules, productIds, categoryIds);
    const slug =
      dto.slug !== undefined || dto.name !== undefined
        ? await this.resolveSlug(dto.slug ?? current.slug, dto.name ?? current.name, id)
        : current.slug;

    await this.prisma.$transaction([
      ...(dto.productIds
        ? [
            this.prisma.campaignProduct.deleteMany({ where: { campaignId: id } }),
            this.prisma.campaignProduct.createMany({
              data: [...new Set(dto.productIds)].map((productId) => ({
                campaignId: id,
                productId,
              })),
            }),
          ]
        : []),
      ...(dto.categoryIds
        ? [
            this.prisma.campaignCategory.deleteMany({ where: { campaignId: id } }),
            this.prisma.campaignCategory.createMany({
              data: [...new Set(dto.categoryIds)].map((categoryId) => ({
                campaignId: id,
                categoryId,
              })),
            }),
          ]
        : []),
      this.prisma.campaign.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          slug,
          ...(dto.tagline !== undefined && { tagline: dto.tagline || null }),
          ...(dto.description !== undefined && { description: dto.description || null }),
          ...rules,
          ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
          ...(dto.bannerUrl !== undefined && { bannerUrl: dto.bannerUrl }),
          ...(dto.accentColor !== undefined && { accentColor: dto.accentColor }),
        },
        select: { id: true },
      }),
    ]);
    this.pricing.invalidate();

    if (ctx) {
      const fields = Object.keys(dto);
      const toggled = fields.length === 1 && fields[0] === 'isActive';
      await this.audit.record({
        actor: ctx.actor,
        action: 'campaign.updated',
        targetType: 'campaign',
        targetId: id,
        summary: toggled
          ? `${rules.isActive ? 'Published' : 'Unpublished'} campaign “${dto.name ?? current.name}”`
          : `Updated campaign “${dto.name ?? current.name}”: ${fields.join(', ')}`,
        metadata: { fields },
        ipAddress: ctx.ip,
      });
    }
    return this.findOne(id);
  }

  /** Stops a running sale right now (prices return to normal immediately). */
  async endNow(id: number, ctx?: AuditContext): Promise<CampaignDetailEntity> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      select: { name: true, startsAt: true, endsAt: true },
    });
    if (!campaign) throw new NotFoundException('Campaign does not exist.');
    const now = new Date();
    if (campaign.endsAt <= now) throw new BadRequestException('This campaign has already ended.');

    await this.prisma.campaign.update({
      where: { id },
      // A scheduled campaign ended early never ran: keep its window valid.
      data: {
        endsAt: now,
        ...(campaign.startsAt > now && { startsAt: new Date(now.getTime() - 1000) }),
      },
      select: { id: true },
    });
    this.pricing.invalidate();
    if (ctx) {
      await this.audit.record({
        actor: ctx.actor,
        action: 'campaign.updated',
        targetType: 'campaign',
        targetId: id,
        summary: `Ended campaign “${campaign.name}” early`,
        ipAddress: ctx.ip,
      });
    }
    return this.findOne(id);
  }

  /** Only campaigns that never priced an order; the rest keep their history. */
  async remove(id: number, ctx?: AuditContext): Promise<void> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      select: { name: true, _count: { select: { orderItems: true } } },
    });
    if (!campaign) throw new NotFoundException('Campaign does not exist.');
    if (campaign._count.orderItems > 0) {
      throw new ConflictException(
        `“${campaign.name}” has sold items, so it can't be deleted — end it instead to keep your sales history.`,
      );
    }
    await this.prisma.campaign.delete({ where: { id } });
    this.pricing.invalidate();
    if (ctx) {
      await this.audit.record({
        actor: ctx.actor,
        action: 'campaign.deleted',
        targetType: 'campaign',
        targetId: id,
        summary: `Deleted campaign “${campaign.name}”`,
        ipAddress: ctx.ip,
      });
    }
  }

  // ── Storefront ────────────────────────────────────────────────────────────

  /** Published campaigns only; drafts are indistinguishable from missing ones. */
  async findPublic(slug: string, now = new Date()): Promise<PublicCampaignEntity> {
    const row = await this.prisma.campaign.findFirst({
      where: { slug, isActive: true },
      select: CAMPAIGN_SELECT,
    });
    if (!row) throw new NotFoundException('Campaign not found.');
    return this.toPublic(row, now);
  }

  /** The campaign's products with live prices, using the full catalog sort/filter. */
  async products(slug: string, query: CatalogQueryDto): Promise<CatalogPageEntity> {
    const campaign = await this.findPublic(slug);
    const includeIds = await this.pricing.productIdsFor(campaign.id);
    return this.catalog.listProducts(query, { includeIds });
  }

  /** The featured live campaign (ending soonest) and a few of its best sellers. */
  async featured(now = new Date()): Promise<FeaturedCampaignEntity | null> {
    const row = await this.prisma.campaign.findFirst({
      where: { ...this.statusWhere('LIVE', now), isFeatured: true },
      select: CAMPAIGN_SELECT,
      orderBy: [{ endsAt: 'asc' }, { id: 'asc' }],
    });
    if (!row) return null;
    const includeIds = await this.pricing.productIdsFor(row.id);
    if (includeIds.length === 0) return null;
    const page = await this.catalog.listProducts(
      { page: 1, limit: FEATURED_PRODUCT_COUNT, sort: 'best-selling' },
      { includeIds },
    );
    return new FeaturedCampaignEntity({
      campaign: this.toPublic(row, now),
      products: page.items,
      productCount: page.meta.total,
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  statusOf(
    row: Pick<CampaignRules, 'isActive' | 'startsAt' | 'endsAt'>,
    now = new Date(),
  ): CampaignStatus {
    if (!row.isActive) return 'DRAFT';
    if (row.endsAt <= now) return 'ENDED';
    if (row.startsAt > now) return 'SCHEDULED';
    return 'LIVE';
  }

  private statusWhere(status: CampaignStatus, now: Date): Prisma.CampaignWhereInput {
    switch (status) {
      case 'DRAFT':
        return { isActive: false };
      case 'ENDED':
        return { isActive: true, endsAt: { lte: now } };
      case 'SCHEDULED':
        return { isActive: true, startsAt: { gt: now }, endsAt: { gt: now } };
      case 'LIVE':
        return { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } };
    }
  }

  /** A cap means nothing for a fixed discount. */
  private normalize(rules: CampaignRules): CampaignRules {
    return rules.discountType === DiscountType.FIXED_AMOUNT
      ? { ...rules, maxDiscountAmount: null }
      : rules;
  }

  private async assertCoherent(
    rules: CampaignRules,
    productIds: number[],
    categoryIds: number[],
  ): Promise<void> {
    if (rules.discountType === DiscountType.FREE_SHIPPING) {
      throw new BadRequestException('Campaigns take money off — use a coupon for free delivery.');
    }
    if (rules.endsAt <= rules.startsAt) {
      throw new BadRequestException('The end must be after the start.');
    }
    if (
      rules.discountType === DiscountType.PERCENTAGE &&
      rules.discountValue.greaterThan(MAX_CAMPAIGN_PERCENT)
    ) {
      throw new BadRequestException(`A campaign can take at most ${MAX_CAMPAIGN_PERCENT}% off.`);
    }
    if (rules.isActive && productIds.length === 0 && categoryIds.length === 0) {
      throw new BadRequestException('Add at least one product or category before publishing.');
    }
    const [products, categories] = await Promise.all([
      productIds.length > 0 ? this.prisma.product.count({ where: { id: { in: productIds } } }) : 0,
      categoryIds.length > 0
        ? this.prisma.category.count({ where: { id: { in: categoryIds } } })
        : 0,
    ]);
    if (products !== new Set(productIds).size) {
      throw new BadRequestException('Some of the chosen products no longer exist.');
    }
    if (categories !== new Set(categoryIds).size) {
      throw new BadRequestException('Some of the chosen categories no longer exist.');
    }
  }

  /** An explicit slug must be free; an automatic one gets "-2", "-3"… */
  private async resolveSlug(
    requested: string | undefined,
    name: string,
    selfId: number | null,
  ): Promise<string> {
    const base = requested ?? slugify(name);
    if (!base) throw new BadRequestException('Give the campaign a name with letters or numbers.');
    const taken = async (slug: string) => {
      const found = await this.prisma.campaign.findUnique({
        where: { slug },
        select: { id: true, name: true },
      });
      return found && found.id !== selfId ? found : null;
    };
    const clash = await taken(base);
    if (!clash) return base;
    if (requested !== undefined) {
      throw new ConflictException(`The link “${base}” is already used by “${clash.name}”.`);
    }
    for (let n = 2; n < 100; n++) {
      const candidate = `${base.slice(0, 76)}-${n}`;
      if (!(await taken(candidate))) return candidate;
    }
    throw new ConflictException('Choose a different link for this campaign.');
  }

  /** Real sales from non-cancelled orders, per campaign — one grouped query. */
  private async statsFor(ids: number[]): Promise<Map<number, CampaignStatsEntity>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.$queryRaw<
      Array<{ id: number; orders: number; units: number; revenue: Prisma.Decimal | null }>
    >`
      SELECT oi.campaign_id AS id,
             COUNT(DISTINCT oi.order_id)::int AS orders,
             SUM(oi.quantity)::int AS units,
             SUM(oi.unit_price * oi.quantity) AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.campaign_id IN (${Prisma.join(ids)}) AND o.status <> 'CANCELLED'
      GROUP BY oi.campaign_id`;
    return new Map(
      rows.map((row) => [
        row.id,
        new CampaignStatsEntity({
          orders: row.orders,
          units: row.units,
          revenue: new Prisma.Decimal(row.revenue ?? 0),
        }),
      ]),
    );
  }

  private offerOf(
    row: Pick<
      CampaignRow,
      | 'id'
      | 'name'
      | 'slug'
      | 'discountType'
      | 'discountValue'
      | 'maxDiscountAmount'
      | 'startsAt'
      | 'endsAt'
    >,
  ): CampaignOffer {
    return {
      campaignId: row.id,
      name: row.name,
      slug: row.slug,
      discountType: row.discountType,
      discountValue: row.discountValue,
      maxDiscountAmount: row.maxDiscountAmount,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
    };
  }

  private toPublic(row: CampaignRow, now: Date): PublicCampaignEntity {
    return new PublicCampaignEntity({
      id: row.id,
      name: row.name,
      slug: row.slug,
      tagline: row.tagline,
      description: row.description,
      discountType: row.discountType,
      discountValue: row.discountValue,
      maxDiscountAmount: row.maxDiscountAmount,
      label: offerLabel(row),
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      status: this.statusOf(row, now),
      bannerUrl: row.bannerUrl,
      accentColor: row.accentColor,
    });
  }

  private toEntity(
    row: CampaignRow,
    stats: CampaignStatsEntity = NO_STATS,
    now = new Date(),
  ): CampaignEntity {
    return new CampaignEntity({
      ...this.toPublic(row, now),
      isActive: row.isActive,
      isFeatured: row.isFeatured,
      productCount: row._count.products,
      categoryCount: row._count.categories,
      stats,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
