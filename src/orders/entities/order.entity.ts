import { ApiProperty } from '@nestjs/swagger';
import type { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';

export interface ShippingAddressEntityInput {
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export class ShippingAddressEntity {
  @ApiProperty({ example: '123 Main St' })
  addressLine1: string;

  @ApiProperty({ nullable: true, example: 'Apt 4B' })
  addressLine2: string | null;

  @ApiProperty({ example: 'Springfield' })
  city: string;

  @ApiProperty({ example: 'IL' })
  state: string;

  @ApiProperty({ example: '62704' })
  postalCode: string;

  @ApiProperty({ example: 'USA' })
  country: string;

  constructor(partial: ShippingAddressEntityInput) {
    this.addressLine1 = partial.addressLine1;
    this.addressLine2 = partial.addressLine2;
    this.city = partial.city;
    this.state = partial.state;
    this.postalCode = partial.postalCode;
    this.country = partial.country;
  }
}

export class OrderItemProductSummaryEntity {
  @ApiProperty({ example: 101 })
  id: number;

  @ApiProperty({ example: 'iPhone 17 Pro' })
  name: string;

  @ApiProperty({ example: 'iphone-17-pro' })
  slug: string;

  @ApiProperty({ nullable: true, example: 'https://cdn.example.com/products/101/main.jpg' })
  imageUrl: string | null;

  constructor(partial: OrderItemProductSummaryEntity) {
    this.id = partial.id;
    this.name = partial.name;
    this.slug = partial.slug;
    this.imageUrl = partial.imageUrl;
  }
}

interface OrderItemEntityInput {
  id: number;
  productId: number;
  product: OrderItemProductSummaryEntity;
  quantity: number;
  unitPrice: Prisma.Decimal;
  subtotal: Prisma.Decimal;
}

export class OrderItemEntity {
  @ApiProperty({ example: 501 })
  id: number;

  @ApiProperty({ example: 101 })
  productId: number;

  @ApiProperty({ type: () => OrderItemProductSummaryEntity })
  product: OrderItemProductSummaryEntity;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({
    type: String,
    example: '999.00',
    description: 'Price at the moment of purchase, serialized as a string',
  })
  unitPrice: Prisma.Decimal;

  @ApiProperty({
    type: String,
    example: '1998.00',
    description: 'Decimal amount serialized as a string (unitPrice * quantity)',
  })
  subtotal: Prisma.Decimal;

  constructor(partial: OrderItemEntityInput) {
    this.id = partial.id;
    this.productId = partial.productId;
    this.product = partial.product;
    this.quantity = partial.quantity;
    this.unitPrice = partial.unitPrice;
    this.subtotal = partial.subtotal;
  }
}

interface OrderEntityInput {
  id: number;
  userId: number | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  shippingFee: Prisma.Decimal;
  shippingAddress: ShippingAddressEntity;
  items: OrderItemEntity[];
  createdAt: Date;
  updatedAt: Date;
}

export class OrderEntity {
  @ApiProperty({ example: 301 })
  id: number;

  @ApiProperty({ example: 1, nullable: true })
  userId: number | null;

  @ApiProperty({ enum: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'] })
  status: OrderStatus;

  @ApiProperty({ enum: ['UNPAID', 'PAID', 'FAILED', 'REFUNDED'] })
  paymentStatus: PaymentStatus;

  @ApiProperty({
    type: String,
    example: '1998.00',
    description: 'Decimal amount serialized as a string',
  })
  totalAmount: Prisma.Decimal;

  @ApiProperty({
    type: String,
    example: '0.00',
    description: 'Decimal amount serialized as a string',
  })
  discountAmount: Prisma.Decimal;

  @ApiProperty({
    type: String,
    example: '0.00',
    description: 'Decimal amount serialized as a string',
  })
  shippingFee: Prisma.Decimal;

  @ApiProperty({ type: () => ShippingAddressEntity })
  shippingAddress: ShippingAddressEntity;

  @ApiProperty({ type: () => OrderItemEntity, isArray: true })
  items: OrderItemEntity[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: OrderEntityInput) {
    this.id = partial.id;
    this.userId = partial.userId;
    this.status = partial.status;
    this.paymentStatus = partial.paymentStatus;
    this.totalAmount = partial.totalAmount;
    this.discountAmount = partial.discountAmount;
    this.shippingFee = partial.shippingFee;
    this.shippingAddress = partial.shippingAddress;
    this.items = partial.items;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}

interface PaginationMetaEntityInput {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class PaginationMetaEntity {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  constructor(partial: PaginationMetaEntityInput) {
    this.page = partial.page;
    this.limit = partial.limit;
    this.total = partial.total;
    this.totalPages = partial.totalPages;
  }
}

interface PaginatedOrdersEntityInput {
  items: OrderEntity[];
  meta: PaginationMetaEntity;
}

export class PaginatedOrdersEntity {
  @ApiProperty({ type: () => OrderEntity, isArray: true })
  items: OrderEntity[];

  @ApiProperty({ type: () => PaginationMetaEntity })
  meta: PaginationMetaEntity;

  constructor(partial: PaginatedOrdersEntityInput) {
    this.items = partial.items;
    this.meta = partial.meta;
  }
}
