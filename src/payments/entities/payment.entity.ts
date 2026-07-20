import { ApiProperty } from '@nestjs/swagger';
import type { PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';

interface PaymentEntityInput {
  id: number;
  orderId: number;
  provider: PaymentProvider;
  transactionId: string | null;
  amount: Prisma.Decimal;
  status: PaymentStatus;
  createdAt: Date;
}

export class PaymentEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 301 })
  orderId: number;

  @ApiProperty({ enum: ['STRIPE', 'SSLCOMMERZ', 'BKASH', 'COD'] })
  provider: PaymentProvider;

  @ApiProperty({ nullable: true, example: 'ch_3P8xYzABC' })
  transactionId: string | null;

  @ApiProperty({
    type: String,
    example: '1998.00',
    description: 'Decimal amount serialized as a string',
  })
  amount: Prisma.Decimal;

  @ApiProperty({ enum: ['UNPAID', 'PAID', 'FAILED', 'REFUNDED'] })
  status: PaymentStatus;

  @ApiProperty()
  createdAt: Date;

  constructor(partial: PaymentEntityInput) {
    this.id = partial.id;
    this.orderId = partial.orderId;
    this.provider = partial.provider;
    this.transactionId = partial.transactionId;
    this.amount = partial.amount;
    this.status = partial.status;
    this.createdAt = partial.createdAt;
  }
}
