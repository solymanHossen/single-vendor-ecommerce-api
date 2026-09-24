import { ApiProperty } from '@nestjs/swagger';
import type { DiscountType } from '@prisma/client';
import { COLLECTION_KEYS, type CollectionKey } from '../storefront.constants';

// Every entity here is a plain, JSON-safe shape (money as decimal strings,
// dates as ISO strings) because the whole payload round-trips through the
// Redis cache — a Prisma.Decimal or Date would not survive JSON.parse.

export class NavigationCategoryChildEntity {
  @ApiProperty({ example: 2 })
  id: number;

  @ApiProperty({ example: 'Smartphones' })
  name: string;

  @ApiProperty({ example: 'smartphones' })
  slug: string;

  @ApiProperty({ nullable: true, example: 'https://images.unsplash.com/photo-1?w=200' })
  iconUrl: string | null;

  @ApiProperty({ example: 5, description: 'Published products directly in this category' })
  productCount: number;

  constructor(partial: NavigationCategoryChildEntity) {
    this.id = partial.id;
    this.name = partial.name;
    this.slug = partial.slug;
    this.iconUrl = partial.iconUrl;
    this.productCount = partial.productCount;
  }
}

export class NavigationCategoryEntity extends NavigationCategoryChildEntity {
  @ApiProperty({ nullable: true, example: 'Shop the latest smartphones and laptops.' })
  description: string | null;

  @ApiProperty({ type: NavigationCategoryChildEntity, isArray: true })
  children: NavigationCategoryChildEntity[];

  constructor(
    partial: NavigationCategoryChildEntity & {
      description: string | null;
      children: NavigationCategoryChildEntity[];
    },
  ) {
    super(partial);
    this.description = partial.description;
    this.children = partial.children;
  }
}

export class NavigationProductEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Apple iPhone 15 Pro' })
  name: string;

  @ApiProperty({ example: 'iphone-15-pro' })
  slug: string;

  @ApiProperty({ nullable: true, example: 'https://images.unsplash.com/photo-1?w=1200' })
  thumbnailUrl: string | null;

  @ApiProperty({ example: '164999', description: 'Decimal amount serialized as a string' })
  basePrice: string;

  @ApiProperty({ nullable: true, example: '154999', description: 'Decimal amount as a string' })
  discountPrice: string | null;

  @ApiProperty({ example: 'Smartphones' })
  categoryName: string;

  @ApiProperty({ example: 'smartphones' })
  categorySlug: string;

  @ApiProperty({ nullable: true, example: 'Forged in aerospace-grade titanium…' })
  summary: string | null;

  constructor(partial: NavigationProductEntity) {
    this.id = partial.id;
    this.name = partial.name;
    this.slug = partial.slug;
    this.thumbnailUrl = partial.thumbnailUrl;
    this.basePrice = partial.basePrice;
    this.discountPrice = partial.discountPrice;
    this.categoryName = partial.categoryName;
    this.categorySlug = partial.categorySlug;
    this.summary = partial.summary;
  }
}

export class NavigationCollectionEntity {
  @ApiProperty({ enum: COLLECTION_KEYS, example: 'on-sale' })
  key: CollectionKey;

  @ApiProperty({ example: 'On Sale' })
  title: string;

  @ApiProperty({ example: 'Limited-time price drops across the store.' })
  description: string;

  @ApiProperty({ example: 42 })
  productCount: number;

  @ApiProperty({ nullable: true, example: 'https://images.unsplash.com/photo-1?w=200' })
  previewImageUrl: string | null;

  constructor(partial: NavigationCollectionEntity) {
    this.key = partial.key;
    this.title = partial.title;
    this.description = partial.description;
    this.productCount = partial.productCount;
    this.previewImageUrl = partial.previewImageUrl;
  }
}

export class NavigationPromotionEntity {
  @ApiProperty({ example: 'FLASH20' })
  code: string;

  @ApiProperty({ enum: ['PERCENTAGE', 'FIXED_AMOUNT'], example: 'PERCENTAGE' })
  discountType: DiscountType;

  @ApiProperty({ example: '20', description: 'Decimal amount serialized as a string' })
  discountValue: string;

  @ApiProperty({ nullable: true, example: '2000', description: 'Decimal amount as a string' })
  minOrderAmount: string | null;

  @ApiProperty({ nullable: true, example: '2000', description: 'Decimal amount as a string' })
  maxDiscountAmount: string | null;

  @ApiProperty({ example: '2026-09-28T00:00:00.000Z' })
  validUntil: string;

  constructor(partial: NavigationPromotionEntity) {
    this.code = partial.code;
    this.discountType = partial.discountType;
    this.discountValue = partial.discountValue;
    this.minOrderAmount = partial.minOrderAmount;
    this.maxDiscountAmount = partial.maxDiscountAmount;
    this.validUntil = partial.validUntil;
  }
}

export class NavigationEntity {
  @ApiProperty({
    type: NavigationCategoryEntity,
    isArray: true,
    description: 'Top-level categories with published products, largest first',
  })
  categories: NavigationCategoryEntity[];

  @ApiProperty({ type: NavigationCollectionEntity, isArray: true })
  collections: NavigationCollectionEntity[];

  @ApiProperty({
    type: NavigationProductEntity,
    nullable: true,
    description: 'In-stock product with the largest absolute saving',
  })
  spotlight: NavigationProductEntity | null;

  @ApiProperty({
    type: NavigationProductEntity,
    isArray: true,
    description: 'Best-selling products in the recent sales window',
  })
  trending: NavigationProductEntity[];

  @ApiProperty({
    type: NavigationPromotionEntity,
    nullable: true,
    description: 'Active coupon expiring soonest — drives the announcement bar',
  })
  promotion: NavigationPromotionEntity | null;

  @ApiProperty({ example: '2026-09-24T07:30:00.000Z' })
  generatedAt: string;

  constructor(partial: NavigationEntity) {
    this.categories = partial.categories;
    this.collections = partial.collections;
    this.spotlight = partial.spotlight;
    this.trending = partial.trending;
    this.promotion = partial.promotion;
    this.generatedAt = partial.generatedAt;
  }
}
