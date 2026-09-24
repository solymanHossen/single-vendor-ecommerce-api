import { ApiProperty } from '@nestjs/swagger';
import type { Prisma } from '@prisma/client';

/**
 * Why a line can't be bought as-is. The cart keeps such lines (so the
 * shopper sees what changed) but checkout is blocked until they're fixed.
 */
export const CART_LINE_ISSUES = ['UNAVAILABLE', 'OUT_OF_STOCK', 'INSUFFICIENT_STOCK'] as const;
export type CartLineIssue = (typeof CART_LINE_ISSUES)[number];

interface CartItemEntityInput {
  key: string;
  productId: number;
  variantId: number | null;
  name: string;
  slug: string;
  imageUrl: string | null;
  variantLabel: string | null;
  sku: string;
  unitPrice: Prisma.Decimal;
  compareAtPrice: Prisma.Decimal | null;
  quantity: number;
  subtotal: Prisma.Decimal;
  availableStock: number;
  issue: CartLineIssue | null;
}

export class CartItemEntity {
  @ApiProperty({ example: '101:204', description: 'Line id used by PATCH/DELETE /cart/items/:key' })
  key: string;

  @ApiProperty({ example: 101 })
  productId: number;

  @ApiProperty({ nullable: true, example: 204 })
  variantId: number | null;

  @ApiProperty({ example: 'iPhone 17 Pro' })
  name: string;

  @ApiProperty({ example: 'iphone-17-pro' })
  slug: string;

  @ApiProperty({ nullable: true, example: 'https://cdn.example.com/products/101/main.jpg' })
  imageUrl: string | null;

  @ApiProperty({ nullable: true, example: 'Black · 256GB' })
  variantLabel: string | null;

  @ApiProperty({ example: 'IPH17PRO-256-BLK' })
  sku: string;

  @ApiProperty({ type: String, example: '999.00', description: 'Price per unit actually charged' })
  unitPrice: Prisma.Decimal;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '1099.00',
    description: 'Pre-sale price per unit, when the line is discounted',
  })
  compareAtPrice: Prisma.Decimal | null;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ type: String, example: '1998.00', description: 'unitPrice × quantity' })
  subtotal: Prisma.Decimal;

  @ApiProperty({ example: 14, description: 'Units that can currently be bought' })
  availableStock: number;

  @ApiProperty({ enum: CART_LINE_ISSUES, nullable: true, example: null })
  issue: CartLineIssue | null;

  constructor(partial: CartItemEntityInput) {
    this.key = partial.key;
    this.productId = partial.productId;
    this.variantId = partial.variantId;
    this.name = partial.name;
    this.slug = partial.slug;
    this.imageUrl = partial.imageUrl;
    this.variantLabel = partial.variantLabel;
    this.sku = partial.sku;
    this.unitPrice = partial.unitPrice;
    this.compareAtPrice = partial.compareAtPrice;
    this.quantity = partial.quantity;
    this.subtotal = partial.subtotal;
    this.availableStock = partial.availableStock;
    this.issue = partial.issue;
  }
}

interface CartEntityInput {
  items: CartItemEntity[];
  totalItems: number;
  totalPrice: Prisma.Decimal;
  hasIssues: boolean;
}

export class CartEntity {
  @ApiProperty({ type: () => CartItemEntity, isArray: true })
  items: CartItemEntity[];

  @ApiProperty({ example: 3, description: 'Sum of every line item quantity' })
  totalItems: number;

  @ApiProperty({
    type: String,
    example: '1998.00',
    description: 'Sum of every line subtotal (before coupon and shipping)',
  })
  totalPrice: Prisma.Decimal;

  @ApiProperty({
    example: false,
    description: 'True when any line has an issue; checkout is blocked',
  })
  hasIssues: boolean;

  constructor(partial: CartEntityInput) {
    this.items = partial.items;
    this.totalItems = partial.totalItems;
    this.totalPrice = partial.totalPrice;
    this.hasIssues = partial.hasIssues;
  }
}
