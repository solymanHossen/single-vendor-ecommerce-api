import { ApiProperty } from '@nestjs/swagger';
import type { ReturnStatus } from '@prisma/client';

interface ReturnRequestEntityInput {
  id: number;
  orderId: number;
  userId: number;
  reason: string;
  status: ReturnStatus;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ReturnRequestEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 301 })
  orderId: number;

  @ApiProperty({ example: 7 })
  userId: number;

  @ApiProperty({ example: 'The item arrived damaged.' })
  reason: string;

  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED', 'REFUNDED'] })
  status: ReturnStatus;

  @ApiProperty({ nullable: true, example: 'Refund issued to original payment method.' })
  adminNote: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: ReturnRequestEntityInput) {
    this.id = partial.id;
    this.orderId = partial.orderId;
    this.userId = partial.userId;
    this.reason = partial.reason;
    this.status = partial.status;
    this.adminNote = partial.adminNote;
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

interface PaginatedReturnRequestsEntityInput {
  items: ReturnRequestEntity[];
  meta: PaginationMetaEntity;
}

export class PaginatedReturnRequestsEntity {
  @ApiProperty({ type: () => ReturnRequestEntity, isArray: true })
  items: ReturnRequestEntity[];

  @ApiProperty({ type: () => PaginationMetaEntity })
  meta: PaginationMetaEntity;

  constructor(partial: PaginatedReturnRequestsEntityInput) {
    this.items = partial.items;
    this.meta = partial.meta;
  }
}
