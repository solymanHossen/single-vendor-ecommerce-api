import { ApiProperty } from '@nestjs/swagger';
import type { Prisma } from '@prisma/client';

interface CartItemEntityInput {
  productId: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  unitPrice: Prisma.Decimal;
  quantity: number;
  subtotal: Prisma.Decimal;
}

export class CartItemEntity {
  @ApiProperty({ example: 101 })
  productId: number;

  @ApiProperty({ example: 'iPhone 17 Pro' })
  name: string;

  @ApiProperty({ example: 'iphone-17-pro' })
  slug: string;

  @ApiProperty({ nullable: true, example: 'https://cdn.example.com/products/101/main.jpg' })
  imageUrl: string | null;

  @ApiProperty({
    type: String,
    example: '999.00',
    description: 'Decimal amount serialized as a string',
  })
  unitPrice: Prisma.Decimal;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({
    type: String,
    example: '1998.00',
    description: 'Decimal amount serialized as a string (unitPrice * quantity)',
  })
  subtotal: Prisma.Decimal;

  constructor(partial: CartItemEntityInput) {
    this.productId = partial.productId;
    this.name = partial.name;
    this.slug = partial.slug;
    this.imageUrl = partial.imageUrl;
    this.unitPrice = partial.unitPrice;
    this.quantity = partial.quantity;
    this.subtotal = partial.subtotal;
  }
}

interface CartEntityInput {
  items: CartItemEntity[];
  totalItems: number;
  totalPrice: Prisma.Decimal;
}

export class CartEntity {
  @ApiProperty({ type: () => CartItemEntity, isArray: true })
  items: CartItemEntity[];

  @ApiProperty({ example: 3, description: 'Sum of every line item quantity' })
  totalItems: number;

  @ApiProperty({
    type: String,
    example: '1998.00',
    description: 'Decimal amount serialized as a string (sum of every subtotal)',
  })
  totalPrice: Prisma.Decimal;

  constructor(partial: CartEntityInput) {
    this.items = partial.items;
    this.totalItems = partial.totalItems;
    this.totalPrice = partial.totalPrice;
  }
}
