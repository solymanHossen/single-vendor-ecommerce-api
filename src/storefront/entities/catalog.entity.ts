import { ApiProperty } from '@nestjs/swagger';

// Shopper-facing catalog shapes. Money is serialized as decimal strings (the
// API-wide convention for Prisma.Decimal), dates as ISO strings.

export class CatalogProductCardEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Apple iPhone 15 Pro' })
  name: string;

  @ApiProperty({ example: 'iphone-15-pro' })
  slug: string;

  @ApiProperty({ nullable: true, example: 'https://images.unsplash.com/photo-1?w=1200' })
  thumbnailUrl: string | null;

  @ApiProperty({ nullable: true, description: 'Second gallery image, shown on hover' })
  hoverImageUrl: string | null;

  @ApiProperty({ example: '164999' })
  basePrice: string;

  @ApiProperty({ nullable: true, example: '154999' })
  discountPrice: string | null;

  @ApiProperty({ example: 42 })
  stockQuantity: number;

  @ApiProperty({ example: 'Smartphones' })
  categoryName: string;

  @ApiProperty({ example: 'smartphones' })
  categorySlug: string;

  @ApiProperty({ example: 4.6, description: 'Average approved rating, one decimal; 0 if none' })
  ratingAverage: number;

  @ApiProperty({ example: 12 })
  reviewCount: number;

  @ApiProperty({ example: 9, description: 'Number of purchasable variants (0 = simple product)' })
  variantCount: number;

  @ApiProperty({ example: true, description: 'Added within the New Arrivals window' })
  isNew: boolean;

  constructor(partial: CatalogProductCardEntity) {
    this.id = partial.id;
    this.name = partial.name;
    this.slug = partial.slug;
    this.thumbnailUrl = partial.thumbnailUrl;
    this.hoverImageUrl = partial.hoverImageUrl;
    this.basePrice = partial.basePrice;
    this.discountPrice = partial.discountPrice;
    this.stockQuantity = partial.stockQuantity;
    this.categoryName = partial.categoryName;
    this.categorySlug = partial.categorySlug;
    this.ratingAverage = partial.ratingAverage;
    this.reviewCount = partial.reviewCount;
    this.variantCount = partial.variantCount;
    this.isNew = partial.isNew;
  }
}

export class CatalogCategoryRefEntity {
  @ApiProperty({ example: 2 })
  id: number;

  @ApiProperty({ example: 'Smartphones' })
  name: string;

  @ApiProperty({ example: 'smartphones' })
  slug: string;

  constructor(partial: CatalogCategoryRefEntity) {
    this.id = partial.id;
    this.name = partial.name;
    this.slug = partial.slug;
  }
}

export class CatalogAppliedCategoryEntity extends CatalogCategoryRefEntity {
  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ type: CatalogCategoryRefEntity, nullable: true })
  parent: CatalogCategoryRefEntity | null;

  constructor(
    partial: CatalogCategoryRefEntity & {
      description: string | null;
      parent: CatalogCategoryRefEntity | null;
    },
  ) {
    super(partial);
    this.description = partial.description;
    this.parent = partial.parent;
  }
}

export class CatalogCategoryFacetEntity extends CatalogCategoryRefEntity {
  @ApiProperty({ example: 5, description: 'Matching products under the other active filters' })
  productCount: number;

  @ApiProperty({ type: () => CatalogCategoryFacetEntity, isArray: true })
  children: CatalogCategoryFacetEntity[];

  constructor(
    partial: CatalogCategoryRefEntity & {
      productCount: number;
      children: CatalogCategoryFacetEntity[];
    },
  ) {
    super(partial);
    this.productCount = partial.productCount;
    this.children = partial.children;
  }
}

export class CatalogPriceRangeEntity {
  @ApiProperty({ example: '490' })
  min: string;

  @ApiProperty({ example: '369999' })
  max: string;

  constructor(partial: CatalogPriceRangeEntity) {
    this.min = partial.min;
    this.max = partial.max;
  }
}

export class CatalogFacetsEntity {
  @ApiProperty({ type: CatalogCategoryFacetEntity, isArray: true })
  categories: CatalogCategoryFacetEntity[];

  @ApiProperty({ type: CatalogPriceRangeEntity, nullable: true })
  priceRange: CatalogPriceRangeEntity | null;

  constructor(partial: CatalogFacetsEntity) {
    this.categories = partial.categories;
    this.priceRange = partial.priceRange;
  }
}

export class CatalogPageMetaEntity {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 24 })
  limit: number;

  @ApiProperty({ example: 80 })
  total: number;

  @ApiProperty({ example: 4 })
  totalPages: number;

  constructor(partial: CatalogPageMetaEntity) {
    this.page = partial.page;
    this.limit = partial.limit;
    this.total = partial.total;
    this.totalPages = partial.totalPages;
  }
}

export class CatalogPageEntity {
  @ApiProperty({ type: CatalogProductCardEntity, isArray: true })
  items: CatalogProductCardEntity[];

  @ApiProperty({ type: CatalogPageMetaEntity })
  meta: CatalogPageMetaEntity;

  @ApiProperty({ type: CatalogFacetsEntity })
  facets: CatalogFacetsEntity;

  @ApiProperty({ type: CatalogAppliedCategoryEntity, nullable: true })
  category: CatalogAppliedCategoryEntity | null;

  constructor(partial: CatalogPageEntity) {
    this.items = partial.items;
    this.meta = partial.meta;
    this.facets = partial.facets;
    this.category = partial.category;
  }
}

// ── Product detail ───────────────────────────────────────────────────────────

export class ProductDetailImageEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'https://images.unsplash.com/photo-1?w=1200' })
  url: string;

  @ApiProperty({ example: true })
  isThumbnail: boolean;

  constructor(partial: ProductDetailImageEntity) {
    this.id = partial.id;
    this.url = partial.url;
    this.isThumbnail = partial.isThumbnail;
  }
}

export class ProductOptionValueEntity {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: 'Black Titanium' })
  value: string;

  constructor(partial: ProductOptionValueEntity) {
    this.id = partial.id;
    this.value = partial.value;
  }
}

export class ProductOptionGroupEntity {
  @ApiProperty({ example: 1 })
  attributeId: number;

  @ApiProperty({ example: 'Color' })
  name: string;

  @ApiProperty({ type: ProductOptionValueEntity, isArray: true })
  values: ProductOptionValueEntity[];

  constructor(partial: ProductOptionGroupEntity) {
    this.attributeId = partial.attributeId;
    this.name = partial.name;
    this.values = partial.values;
  }
}

export class ProductDetailVariantEntity {
  @ApiProperty({ example: 201 })
  id: number;

  @ApiProperty({ example: 'ELC-PHN-001-BLAT-256GB' })
  sku: string;

  @ApiProperty({ example: '169999' })
  price: string;

  @ApiProperty({ example: 16 })
  stockQuantity: number;

  @ApiProperty({ nullable: true })
  imageUrl: string | null;

  @ApiProperty({ type: Number, isArray: true, description: 'Attribute option ids of this variant' })
  optionIds: number[];

  constructor(partial: ProductDetailVariantEntity) {
    this.id = partial.id;
    this.sku = partial.sku;
    this.price = partial.price;
    this.stockQuantity = partial.stockQuantity;
    this.imageUrl = partial.imageUrl;
    this.optionIds = partial.optionIds;
  }
}

export class RatingSummaryEntity {
  @ApiProperty({ example: 4.4 })
  average: number;

  @ApiProperty({ example: 18 })
  count: number;

  @ApiProperty({
    example: { '1': 0, '2': 1, '3': 2, '4': 5, '5': 10 },
    description: 'Approved review count per star rating',
  })
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;

  constructor(partial: RatingSummaryEntity) {
    this.average = partial.average;
    this.count = partial.count;
    this.distribution = partial.distribution;
  }
}

export class ProductDetailEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Apple iPhone 15 Pro' })
  name: string;

  @ApiProperty({ example: 'iphone-15-pro' })
  slug: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ example: '164999' })
  basePrice: string;

  @ApiProperty({ nullable: true, example: '154999' })
  discountPrice: string | null;

  @ApiProperty({ example: 'ELC-PHN-001' })
  sku: string;

  @ApiProperty({ example: 124 })
  stockQuantity: number;

  @ApiProperty({ nullable: true })
  metaTitle: string | null;

  @ApiProperty({ nullable: true })
  metaDesc: string | null;

  @ApiProperty({ type: CatalogAppliedCategoryEntity })
  category: CatalogAppliedCategoryEntity;

  @ApiProperty({ type: ProductDetailImageEntity, isArray: true })
  images: ProductDetailImageEntity[];

  @ApiProperty({ type: ProductOptionGroupEntity, isArray: true })
  optionGroups: ProductOptionGroupEntity[];

  @ApiProperty({ type: ProductDetailVariantEntity, isArray: true })
  variants: ProductDetailVariantEntity[];

  @ApiProperty({ type: RatingSummaryEntity })
  rating: RatingSummaryEntity;

  @ApiProperty({ example: 37, description: 'Units sold in the recent sales window' })
  recentlySold: number;

  @ApiProperty({ type: CatalogProductCardEntity, isArray: true })
  related: CatalogProductCardEntity[];

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  createdAt: string;

  constructor(partial: ProductDetailEntity) {
    this.id = partial.id;
    this.name = partial.name;
    this.slug = partial.slug;
    this.description = partial.description;
    this.basePrice = partial.basePrice;
    this.discountPrice = partial.discountPrice;
    this.sku = partial.sku;
    this.stockQuantity = partial.stockQuantity;
    this.metaTitle = partial.metaTitle;
    this.metaDesc = partial.metaDesc;
    this.category = partial.category;
    this.images = partial.images;
    this.optionGroups = partial.optionGroups;
    this.variants = partial.variants;
    this.rating = partial.rating;
    this.recentlySold = partial.recentlySold;
    this.related = partial.related;
    this.createdAt = partial.createdAt;
  }
}
