import { ApiProperty } from '@nestjs/swagger';
import type { DiscountType, Prisma } from '@prisma/client';
import { CAMPAIGN_STATUSES, type CampaignStatus } from '../campaigns.constants';
import { CatalogProductCardEntity } from '../../storefront/entities/catalog.entity';

const MONEY = { type: String, description: 'Decimal amount serialized as a string' } as const;

export class CampaignStatsEntity {
  @ApiProperty({ example: 42 })
  orders: number;

  @ApiProperty({ example: 97 })
  units: number;

  @ApiProperty(MONEY)
  revenue: Prisma.Decimal;

  constructor(partial: CampaignStatsEntity) {
    this.orders = partial.orders;
    this.units = partial.units;
    this.revenue = partial.revenue;
  }
}

/** Fields shoppers may see. */
export class PublicCampaignEntity {
  @ApiProperty({ example: 7 })
  id: number;

  @ApiProperty({ example: 'Eid Mega Sale' })
  name: string;

  @ApiProperty({ example: 'eid-mega-sale' })
  slug: string;

  @ApiProperty({ nullable: true, example: 'Up to 40% off fashion and gifts' })
  tagline: string | null;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ enum: ['PERCENTAGE', 'FIXED_AMOUNT'] })
  discountType: DiscountType;

  @ApiProperty(MONEY)
  discountValue: Prisma.Decimal;

  @ApiProperty({ ...MONEY, nullable: true })
  maxDiscountAmount: Prisma.Decimal | null;

  @ApiProperty({ example: '20% off' })
  label: string;

  @ApiProperty()
  startsAt: Date;

  @ApiProperty()
  endsAt: Date;

  @ApiProperty({ enum: CAMPAIGN_STATUSES })
  status: CampaignStatus;

  @ApiProperty({ nullable: true })
  bannerUrl: string | null;

  @ApiProperty({ nullable: true, example: '#0f766e' })
  accentColor: string | null;

  constructor(partial: PublicCampaignEntity) {
    this.id = partial.id;
    this.name = partial.name;
    this.slug = partial.slug;
    this.tagline = partial.tagline;
    this.description = partial.description;
    this.discountType = partial.discountType;
    this.discountValue = partial.discountValue;
    this.maxDiscountAmount = partial.maxDiscountAmount;
    this.label = partial.label;
    this.startsAt = partial.startsAt;
    this.endsAt = partial.endsAt;
    this.status = partial.status;
    this.bannerUrl = partial.bannerUrl;
    this.accentColor = partial.accentColor;
  }
}

export class CampaignEntity extends PublicCampaignEntity {
  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  isFeatured: boolean;

  @ApiProperty({ example: 12, description: 'Products chosen one by one' })
  productCount: number;

  @ApiProperty({ example: 2, description: 'Whole categories in the sale' })
  categoryCount: number;

  @ApiProperty({ type: () => CampaignStatsEntity })
  stats: CampaignStatsEntity;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: CampaignEntity) {
    super(partial);
    this.isActive = partial.isActive;
    this.isFeatured = partial.isFeatured;
    this.productCount = partial.productCount;
    this.categoryCount = partial.categoryCount;
    this.stats = partial.stats;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}

export class CampaignProductEntity {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  imageUrl: string | null;

  @ApiProperty({ ...MONEY, description: 'List price, before any sale' })
  basePrice: Prisma.Decimal;

  @ApiProperty({ ...MONEY, description: 'Regular selling price (product sale applied)' })
  price: Prisma.Decimal;

  @ApiProperty({ ...MONEY, description: 'Price with this campaign' })
  campaignPrice: Prisma.Decimal;

  @ApiProperty()
  stockQuantity: number;

  @ApiProperty()
  isPublished: boolean;

  constructor(partial: CampaignProductEntity) {
    this.id = partial.id;
    this.name = partial.name;
    this.imageUrl = partial.imageUrl;
    this.basePrice = partial.basePrice;
    this.price = partial.price;
    this.campaignPrice = partial.campaignPrice;
    this.stockQuantity = partial.stockQuantity;
    this.isPublished = partial.isPublished;
  }
}

export class CampaignDetailEntity extends CampaignEntity {
  @ApiProperty({ type: () => CampaignProductEntity, isArray: true })
  products: CampaignProductEntity[];

  @ApiProperty({ isArray: true })
  categories: Array<{ id: number; name: string; productCount: number }>;

  @ApiProperty({
    example: 57,
    description: 'Published products the sale covers (chosen + categories)',
  })
  coveredProductCount: number;

  constructor(partial: CampaignDetailEntity) {
    super(partial);
    this.products = partial.products;
    this.categories = partial.categories;
    this.coveredProductCount = partial.coveredProductCount;
  }
}

export class PaginatedCampaignsEntity {
  @ApiProperty({ type: () => CampaignEntity, isArray: true })
  items: CampaignEntity[];

  @ApiProperty()
  meta: { page: number; limit: number; total: number; totalPages: number };

  @ApiProperty({ example: { DRAFT: 1, SCHEDULED: 2, LIVE: 1, ENDED: 4, ALL: 8 } })
  counts: Record<CampaignStatus | 'ALL', number>;

  constructor(partial: PaginatedCampaignsEntity) {
    this.items = partial.items;
    this.meta = partial.meta;
    this.counts = partial.counts;
  }
}

export class FeaturedCampaignEntity {
  @ApiProperty({ type: () => PublicCampaignEntity })
  campaign: PublicCampaignEntity;

  @ApiProperty({ type: () => CatalogProductCardEntity, isArray: true })
  products: CatalogProductCardEntity[];

  @ApiProperty()
  productCount: number;

  constructor(partial: FeaturedCampaignEntity) {
    this.campaign = partial.campaign;
    this.products = partial.products;
    this.productCount = partial.productCount;
  }
}
