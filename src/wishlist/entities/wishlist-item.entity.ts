import { ApiProperty } from '@nestjs/swagger';
import type { Prisma } from '@prisma/client';

interface WishlistProductSummaryEntityInput {
  id: number;
  name: string;
  slug: string;
  price: Prisma.Decimal;
  imageUrl: string | null;
}

export class WishlistProductSummaryEntity {
  @ApiProperty({ example: 101 })
  id: number;

  @ApiProperty({ example: 'iPhone 17 Pro' })
  name: string;

  @ApiProperty({ example: 'iphone-17-pro' })
  slug: string;

  @ApiProperty({
    type: String,
    example: '899.00',
    description:
      'Effective price (discountPrice if set, otherwise basePrice), serialized as a string',
  })
  price: Prisma.Decimal;

  @ApiProperty({ nullable: true, example: 'https://cdn.example.com/products/101/main.jpg' })
  imageUrl: string | null;

  constructor(partial: WishlistProductSummaryEntityInput) {
    this.id = partial.id;
    this.name = partial.name;
    this.slug = partial.slug;
    this.price = partial.price;
    this.imageUrl = partial.imageUrl;
  }
}

interface WishlistItemEntityInput {
  id: number;
  productId: number;
  product: WishlistProductSummaryEntity;
  createdAt: Date;
}

export class WishlistItemEntity {
  @ApiProperty({ example: 5 })
  id: number;

  @ApiProperty({ example: 101 })
  productId: number;

  @ApiProperty({ type: () => WishlistProductSummaryEntity })
  product: WishlistProductSummaryEntity;

  @ApiProperty()
  createdAt: Date;

  constructor(partial: WishlistItemEntityInput) {
    this.id = partial.id;
    this.productId = partial.productId;
    this.product = partial.product;
    this.createdAt = partial.createdAt;
  }
}
