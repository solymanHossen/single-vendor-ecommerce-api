import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { PaymentEntity } from './entities/payment.entity';

const PAYMENT_SELECT = {
  id: true,
  orderId: true,
  provider: true,
  transactionId: true,
  amount: true,
  status: true,
  createdAt: true,
} satisfies Prisma.PaymentSelect;

type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof PAYMENT_SELECT }>;

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePaymentDto): Promise<PaymentEntity> {
    // orderId is a plain scalar assignment (not a nested `connect`), so a
    // reference to an order that doesn't exist fails the FK constraint at
    // the database level (P2003 → 422). Order.payment is @unique, so a
    // second payment for the same order hits that constraint (P2002 → 409)
    // — both translated by PrismaClientExceptionFilter, no manual checks needed.
    const payment = await this.prisma.payment.create({
      data: dto,
      select: PAYMENT_SELECT,
    });

    return this.toEntity(payment);
  }

  async findOne(requester: AuthUser, id: number): Promise<PaymentEntity> {
    const isStaff = requester.role === Role.ADMIN || requester.role === Role.SUPER_ADMIN;

    const payment = await this.prisma.payment.findFirst({
      where: { id, ...(isStaff ? {} : { order: { userId: requester.id } }) },
      select: PAYMENT_SELECT,
    });

    if (!payment) {
      throw new NotFoundException('Payment does not exist.');
    }

    return this.toEntity(payment);
  }

  async updateStatus(id: number, dto: UpdatePaymentStatusDto): Promise<PaymentEntity> {
    // Payment.status and Order.paymentStatus must never drift apart — both
    // writes commit or roll back together.
    const payment = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: { status: dto.status, transactionId: dto.transactionId },
        select: PAYMENT_SELECT,
      });

      await tx.order.update({
        where: { id: updated.orderId },
        data: { paymentStatus: dto.status },
        select: { id: true },
      });

      return updated;
    });

    return this.toEntity(payment);
  }

  private toEntity(payment: PaymentRow): PaymentEntity {
    return new PaymentEntity({
      id: payment.id,
      orderId: payment.orderId,
      provider: payment.provider,
      transactionId: payment.transactionId,
      amount: payment.amount,
      status: payment.status,
      createdAt: payment.createdAt,
    });
  }
}
