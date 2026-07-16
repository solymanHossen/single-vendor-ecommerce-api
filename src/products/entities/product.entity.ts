import { ApiProperty } from '@nestjs/swagger';
import type { Prisma } from '@prisma/client';
import { CategorySummaryEntity } from '../../categories/entities/category.entity';

export class ProductImageEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'https://cdn.example.com/products/1/main.jpg' })
  url: string;

  @ApiProperty({ example: true })
  isThumbnail: boolean;

  constructor(partial: ProductImageEntity) {
    this.id = partial.id;
    this.url = partial.url;
    this.isThumbnail = partial.isThumbnail;
  }
}

interface ProductEntityInput {
  id: number;
  categoryId: number;
  category: CategorySummaryEntity;
  name: string;
  slug: string;
  description: string;
  basePrice: Prisma.Decimal;
  discountPrice: Prisma.Decimal | null;
  sku: string;
  stockQuantity: number;
  isPublished: boolean;
  metaTitle: string | null;
  metaDesc: string | null;
  images: ProductImageEntity[];
  createdAt: Date;
  updatedAt: Date;
}

export class ProductEntity {
  @ApiProperty({ example: 101 })
  id: number;

  @ApiProperty({ example: 3 })
  categoryId: number;

  @ApiProperty({ type: () => CategorySummaryEntity })
  category: CategorySummaryEntity;

  @ApiProperty({ example: 'iPhone 17 Pro' })
  name: string;

  @ApiProperty({ example: 'iphone-17-pro' })
  slug: string;

  @ApiProperty({ example: 'Flagship smartphone with titanium chassis.' })
  description: string;

  @ApiProperty({
    type: String,
    example: '999.00',
    description: 'Decimal amount serialized as a string',
  })
  basePrice: Prisma.Decimal;

  @ApiProperty({
    type: String,
    example: '899.00',
    nullable: true,
    description: 'Decimal amount serialized as a string',
  })
  discountPrice: Prisma.Decimal | null;

  @ApiProperty({ example: 'IPH17PRO-256-BLK' })
  sku: string;

  @ApiProperty({ example: 42 })
  stockQuantity: number;

  @ApiProperty({ example: true })
  isPublished: boolean;

  @ApiProperty({ nullable: true })
  metaTitle: string | null;

  @ApiProperty({ nullable: true })
  metaDesc: string | null;

  @ApiProperty({ type: () => ProductImageEntity, isArray: true })
  images: ProductImageEntity[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: ProductEntityInput) {
    this.id = partial.id;
    this.categoryId = partial.categoryId;
    this.category = partial.category;
    this.name = partial.name;
    this.slug = partial.slug;
    this.description = partial.description;
    this.basePrice = partial.basePrice;
    this.discountPrice = partial.discountPrice;
    this.sku = partial.sku;
    this.stockQuantity = partial.stockQuantity;
    this.isPublished = partial.isPublished;
    this.metaTitle = partial.metaTitle;
    this.metaDesc = partial.metaDesc;
    this.images = partial.images;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}

export class PaginationMetaEntity {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 134 })
  total: number;

  @ApiProperty({ example: 7 })
  totalPages: number;

  constructor(partial: PaginationMetaEntity) {
    this.page = partial.page;
    this.limit = partial.limit;
    this.total = partial.total;
    this.totalPages = partial.totalPages;
  }
}

export class PaginatedProductsEntity {
  @ApiProperty({ type: () => ProductEntity, isArray: true })
  items: ProductEntity[];

  @ApiProperty({ type: () => PaginationMetaEntity })
  meta: PaginationMetaEntity;

  constructor(partial: PaginatedProductsEntity) {
    this.items = partial.items;
    this.meta = partial.meta;
  }
}
