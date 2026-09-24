import { ApiProperty } from '@nestjs/swagger';
import type { Prisma } from '@prisma/client';
import { PaginationMetaEntity } from './product.entity';

export class AdminProductCategoryEntity {
  @ApiProperty({ example: 3 })
  id: number;

  @ApiProperty({ example: 'Smartphones' })
  name: string;

  constructor(partial: AdminProductCategoryEntity) {
    this.id = partial.id;
    this.name = partial.name;
  }
}

/** One catalogue row — only what the admin table renders. */
export class AdminProductRowEntity {
  @ApiProperty({ example: 101 })
  id: number;

  @ApiProperty({ example: 'iPhone 17 Pro' })
  name: string;

  @ApiProperty({ example: 'iphone-17-pro' })
  slug: string;

  @ApiProperty({ example: 'IPH17PRO' })
  sku: string;

  @ApiProperty({ type: String, example: '999.00', description: 'Decimal serialized as a string' })
  basePrice: Prisma.Decimal;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '899.00',
    description: 'Decimal serialized as a string',
  })
  discountPrice: Prisma.Decimal | null;

  @ApiProperty({ example: 42, description: 'Sum of variant stock when the product has variants' })
  stockQuantity: number;

  @ApiProperty({ example: true })
  isPublished: boolean;

  @ApiProperty({ nullable: true, example: 'https://cdn.example.com/products/1/main.jpg' })
  thumbnailUrl: string | null;

  @ApiProperty({ type: () => AdminProductCategoryEntity })
  category: AdminProductCategoryEntity;

  @ApiProperty({ example: 4 })
  variantCount: number;

  @ApiProperty({ example: 17, description: 'Order lines referencing this product' })
  orderCount: number;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-02T00:00:00.000Z' })
  updatedAt: Date;

  constructor(partial: AdminProductRowEntity) {
    this.id = partial.id;
    this.name = partial.name;
    this.slug = partial.slug;
    this.sku = partial.sku;
    this.basePrice = partial.basePrice;
    this.discountPrice = partial.discountPrice;
    this.stockQuantity = partial.stockQuantity;
    this.isPublished = partial.isPublished;
    this.thumbnailUrl = partial.thumbnailUrl;
    this.category = partial.category;
    this.variantCount = partial.variantCount;
    this.orderCount = partial.orderCount;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}

/**
 * Counts for the status tabs. They honour search + category but ignore the
 * status/stock filters, so every tab keeps showing its own size while one
 * of them is selected.
 */
export class AdminProductSummaryEntity {
  @ApiProperty({ example: 82 })
  total: number;

  @ApiProperty({ example: 80 })
  published: number;

  @ApiProperty({ example: 2 })
  draft: number;

  @ApiProperty({ example: 3, description: 'Stock between 1 and lowStockThreshold' })
  lowStock: number;

  @ApiProperty({ example: 2 })
  outOfStock: number;

  @ApiProperty({ example: 5 })
  lowStockThreshold: number;

  constructor(partial: AdminProductSummaryEntity) {
    this.total = partial.total;
    this.published = partial.published;
    this.draft = partial.draft;
    this.lowStock = partial.lowStock;
    this.outOfStock = partial.outOfStock;
    this.lowStockThreshold = partial.lowStockThreshold;
  }
}

export class PaginatedAdminProductsEntity {
  @ApiProperty({ type: () => AdminProductRowEntity, isArray: true })
  items: AdminProductRowEntity[];

  @ApiProperty({ type: () => PaginationMetaEntity })
  meta: PaginationMetaEntity;

  @ApiProperty({ type: () => AdminProductSummaryEntity })
  summary: AdminProductSummaryEntity;

  constructor(partial: PaginatedAdminProductsEntity) {
    this.items = partial.items;
    this.meta = partial.meta;
    this.summary = partial.summary;
  }
}

export class BulkProductStatusResultEntity {
  @ApiProperty({ example: 3 })
  updated: number;

  constructor(partial: BulkProductStatusResultEntity) {
    this.updated = partial.updated;
  }
}
