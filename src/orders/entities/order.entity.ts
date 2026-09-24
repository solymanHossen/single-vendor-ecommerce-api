import { ApiProperty } from '@nestjs/swagger';
import type { OrderStatus, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';

const ORDER_STATUS_ENUM = [
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
];

export interface ShippingAddressEntityInput {
  // Older orders were snapshotted before these existed.
  recipientName?: string | null;
  phone?: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export class ShippingAddressEntity {
  @ApiProperty({ nullable: true, example: 'Nusrat Jahan' })
  recipientName: string | null;

  @ApiProperty({ nullable: true, example: '+8801712345678' })
  phone: string | null;

  @ApiProperty({ example: 'House 12, Road 5, Dhanmondi' })
  addressLine1: string;

  @ApiProperty({ nullable: true, example: 'Flat 4B' })
  addressLine2: string | null;

  @ApiProperty({ example: 'Dhaka' })
  city: string;

  @ApiProperty({ example: 'Dhaka Division' })
  state: string;

  @ApiProperty({ example: '1209' })
  postalCode: string;

  @ApiProperty({ example: 'Bangladesh' })
  country: string;

  constructor(partial: ShippingAddressEntityInput) {
    this.recipientName = partial.recipientName ?? null;
    this.phone = partial.phone ?? null;
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
  variantId: number | null;
  variantLabel: string | null;
  sku: string;
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

  @ApiProperty({ nullable: true, example: 204 })
  variantId: number | null;

  @ApiProperty({
    nullable: true,
    example: 'Black · 256GB',
    description: 'Null for simple products, or when the variant was deleted later',
  })
  variantLabel: string | null;

  @ApiProperty({ example: 'IPH17PRO-256-BLK' })
  sku: string;

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
    this.variantId = partial.variantId;
    this.variantLabel = partial.variantLabel;
    this.sku = partial.sku;
    this.product = partial.product;
    this.quantity = partial.quantity;
    this.unitPrice = partial.unitPrice;
    this.subtotal = partial.subtotal;
  }
}

export class OrderPaymentEntity {
  @ApiProperty({ enum: ['STRIPE', 'SSLCOMMERZ', 'BKASH', 'COD'] })
  provider: PaymentProvider;

  @ApiProperty({ enum: ['UNPAID', 'PAID', 'FAILED', 'REFUNDED'] })
  status: PaymentStatus;

  @ApiProperty({ nullable: true, example: 'BK8X2K1Q9P' })
  transactionId: string | null;

  constructor(partial: OrderPaymentEntity) {
    this.provider = partial.provider;
    this.status = partial.status;
    this.transactionId = partial.transactionId;
  }
}

export class OrderCustomerEntity {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ nullable: true, example: 'Nusrat Jahan' })
  name: string | null;

  @ApiProperty({ example: 'nusrat@example.com' })
  email: string;

  @ApiProperty({ nullable: true, example: '+8801712345678' })
  phone: string | null;

  constructor(partial: OrderCustomerEntity) {
    this.id = partial.id;
    this.name = partial.name;
    this.email = partial.email;
    this.phone = partial.phone;
  }
}

interface OrderEntityInput {
  id: number;
  userId: number | null;
  customer: OrderCustomerEntity | null;
  status: OrderStatus;
  nextStatuses: OrderStatus[];
  paymentStatus: PaymentStatus;
  payment: OrderPaymentEntity | null;
  subtotal: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  shippingFee: Prisma.Decimal;
  couponCode: string | null;
  note: string | null;
  shippingAddress: ShippingAddressEntity;
  itemCount: number;
  items: OrderItemEntity[];
  createdAt: Date;
  updatedAt: Date;
}

export class OrderEntity {
  @ApiProperty({ example: 301 })
  id: number;

  @ApiProperty({ example: 1, nullable: true })
  userId: number | null;

  @ApiProperty({ type: () => OrderCustomerEntity, nullable: true })
  customer: OrderCustomerEntity | null;

  @ApiProperty({ enum: ORDER_STATUS_ENUM })
  status: OrderStatus;

  @ApiProperty({
    enum: ORDER_STATUS_ENUM,
    isArray: true,
    description: 'Statuses an admin may move this order to next',
  })
  nextStatuses: OrderStatus[];

  @ApiProperty({ enum: ['UNPAID', 'PAID', 'FAILED', 'REFUNDED'] })
  paymentStatus: PaymentStatus;

  @ApiProperty({ type: () => OrderPaymentEntity, nullable: true })
  payment: OrderPaymentEntity | null;

  @ApiProperty({ type: String, example: '1998.00', description: 'Sum of line subtotals' })
  subtotal: Prisma.Decimal;

  @ApiProperty({
    type: String,
    example: '1938.00',
    description: 'subtotal − discountAmount + shippingFee',
  })
  totalAmount: Prisma.Decimal;

  @ApiProperty({ type: String, example: '120.00' })
  discountAmount: Prisma.Decimal;

  @ApiProperty({ type: String, example: '60.00' })
  shippingFee: Prisma.Decimal;

  @ApiProperty({ nullable: true, example: 'FLASH20' })
  couponCode: string | null;

  @ApiProperty({ nullable: true, example: 'Please call before delivery.' })
  note: string | null;

  @ApiProperty({ type: () => ShippingAddressEntity })
  shippingAddress: ShippingAddressEntity;

  @ApiProperty({ example: 3, description: 'Total units across all lines' })
  itemCount: number;

  @ApiProperty({ type: () => OrderItemEntity, isArray: true })
  items: OrderItemEntity[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: OrderEntityInput) {
    this.id = partial.id;
    this.userId = partial.userId;
    this.customer = partial.customer;
    this.status = partial.status;
    this.nextStatuses = partial.nextStatuses;
    this.paymentStatus = partial.paymentStatus;
    this.payment = partial.payment;
    this.subtotal = partial.subtotal;
    this.totalAmount = partial.totalAmount;
    this.discountAmount = partial.discountAmount;
    this.shippingFee = partial.shippingFee;
    this.couponCode = partial.couponCode;
    this.note = partial.note;
    this.shippingAddress = partial.shippingAddress;
    this.itemCount = partial.itemCount;
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

export class OrderStatusCountEntity {
  @ApiProperty({ enum: ORDER_STATUS_ENUM })
  status: OrderStatus;

  @ApiProperty({ example: 12 })
  count: number;

  constructor(partial: OrderStatusCountEntity) {
    this.status = partial.status;
    this.count = partial.count;
  }
}

interface PaginatedOrdersEntityInput {
  items: OrderEntity[];
  meta: PaginationMetaEntity;
  statusCounts: OrderStatusCountEntity[];
}

export class PaginatedOrdersEntity {
  @ApiProperty({ type: () => OrderEntity, isArray: true })
  items: OrderEntity[];

  @ApiProperty({ type: () => PaginationMetaEntity })
  meta: PaginationMetaEntity;

  @ApiProperty({
    type: () => OrderStatusCountEntity,
    isArray: true,
    description: 'Per-status totals for the same scope, ignoring the status filter (for tabs)',
  })
  statusCounts: OrderStatusCountEntity[];

  constructor(partial: PaginatedOrdersEntityInput) {
    this.items = partial.items;
    this.meta = partial.meta;
    this.statusCounts = partial.statusCounts;
  }
}

export class QuoteCouponEntity {
  @ApiProperty({ example: 'FLASH20' })
  code: string;

  @ApiProperty({ enum: ['PERCENTAGE', 'FIXED_AMOUNT'] })
  discountType: string;

  @ApiProperty({ type: String, example: '20.00' })
  discountValue: Prisma.Decimal;

  constructor(partial: QuoteCouponEntity) {
    this.code = partial.code;
    this.discountType = partial.discountType;
    this.discountValue = partial.discountValue;
  }
}

/** Live checkout totals for the current cart — nothing is reserved or written. */
export class OrderQuoteEntity {
  @ApiProperty({ example: 3 })
  itemCount: number;

  @ApiProperty({ type: String, example: '5400.00' })
  subtotal: Prisma.Decimal;

  @ApiProperty({ type: String, example: '1080.00' })
  discountAmount: Prisma.Decimal;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '60.00',
    description: 'Null until an address is chosen (the fee depends on the city)',
  })
  shippingFee: Prisma.Decimal | null;

  @ApiProperty({ type: String, example: '4380.00' })
  totalAmount: Prisma.Decimal;

  @ApiProperty({ type: () => QuoteCouponEntity, nullable: true })
  coupon: QuoteCouponEntity | null;

  @ApiProperty({ nullable: true, example: 'This coupon has expired.' })
  couponError: string | null;

  @ApiProperty({ type: String, example: '10000.00' })
  freeShippingThreshold: Prisma.Decimal;

  @ApiProperty({ type: String, example: '4600.00', description: '0 once shipping is free' })
  amountToFreeShipping: Prisma.Decimal;

  @ApiProperty({ nullable: true, example: true })
  insideDhaka: boolean | null;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['Only 2 left of "Sony WH-1000XM6" — lower the quantity.'],
    description: 'Blocking issues; the order cannot be placed while any exist',
  })
  problems: string[];

  constructor(partial: OrderQuoteEntity) {
    this.itemCount = partial.itemCount;
    this.subtotal = partial.subtotal;
    this.discountAmount = partial.discountAmount;
    this.shippingFee = partial.shippingFee;
    this.totalAmount = partial.totalAmount;
    this.coupon = partial.coupon;
    this.couponError = partial.couponError;
    this.freeShippingThreshold = partial.freeShippingThreshold;
    this.amountToFreeShipping = partial.amountToFreeShipping;
    this.insideDhaka = partial.insideDhaka;
    this.problems = partial.problems;
  }
}
