import { ApiProperty } from '@nestjs/swagger';
import type { Prisma } from '@prisma/client';

export class VariantAttributeOptionEntity {
  @ApiProperty({ example: 10, description: 'AttributeOption id' })
  attributeOptionId: number;

  @ApiProperty({ example: 3 })
  attributeId: number;

  @ApiProperty({ example: 'Color' })
  attributeName: string;

  @ApiProperty({ example: 'Red' })
  value: string;

  constructor(partial: VariantAttributeOptionEntity) {
    this.attributeOptionId = partial.attributeOptionId;
    this.attributeId = partial.attributeId;
    this.attributeName = partial.attributeName;
    this.value = partial.value;
  }
}

interface ProductVariantSummaryInput {
  id: number;
  sku: string;
  price: Prisma.Decimal;
  stockQuantity: number;
  imageUrl: string | null;
  options: VariantAttributeOptionEntity[];
}

export class ProductVariantSummaryEntity {
  @ApiProperty({ example: 201 })
  id: number;

  @ApiProperty({ example: 'IPH17PRO-256-RED' })
  sku: string;

  @ApiProperty({
    type: String,
    example: '999.00',
    description: 'Decimal amount serialized as a string',
  })
  price: Prisma.Decimal;

  @ApiProperty({ example: 12 })
  stockQuantity: number;

  @ApiProperty({ nullable: true, example: 'https://cdn.example.com/variants/201/red.jpg' })
  imageUrl: string | null;

  @ApiProperty({ type: () => VariantAttributeOptionEntity, isArray: true })
  options: VariantAttributeOptionEntity[];

  constructor(partial: ProductVariantSummaryInput) {
    this.id = partial.id;
    this.sku = partial.sku;
    this.price = partial.price;
    this.stockQuantity = partial.stockQuantity;
    this.imageUrl = partial.imageUrl;
    this.options = partial.options;
  }
}

interface ProductVariantEntityInput {
  id: number;
  productId: number;
  sku: string;
  price: Prisma.Decimal;
  stockQuantity: number;
  imageUrl: string | null;
  options: VariantAttributeOptionEntity[];
  createdAt: Date;
  updatedAt: Date;
}

export class ProductVariantEntity {
  @ApiProperty({ example: 201 })
  id: number;

  @ApiProperty({ example: 101 })
  productId: number;

  @ApiProperty({ example: 'IPH17PRO-256-RED' })
  sku: string;

  @ApiProperty({
    type: String,
    example: '999.00',
    description: 'Decimal amount serialized as a string',
  })
  price: Prisma.Decimal;

  @ApiProperty({ example: 12 })
  stockQuantity: number;

  @ApiProperty({ nullable: true, example: 'https://cdn.example.com/variants/201/red.jpg' })
  imageUrl: string | null;

  @ApiProperty({ type: () => VariantAttributeOptionEntity, isArray: true })
  options: VariantAttributeOptionEntity[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: ProductVariantEntityInput) {
    this.id = partial.id;
    this.productId = partial.productId;
    this.sku = partial.sku;
    this.price = partial.price;
    this.stockQuantity = partial.stockQuantity;
    this.imageUrl = partial.imageUrl;
    this.options = partial.options;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}
