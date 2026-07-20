import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma, ReturnStatus, Role } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { CreateReturnRequestDto } from './dto/create-return-request.dto';
import { UpdateReturnStatusDto } from './dto/update-return-status.dto';
import { ReturnQueryDto } from './dto/query-return.dto';
import {
  PaginatedReturnRequestsEntity,
  PaginationMetaEntity,
  ReturnRequestEntity,
} from './entities/return-request.entity';

const RETURN_REQUEST_SELECT = {
  id: true,
  orderId: true,
  userId: true,
  reason: true,
  status: true,
  adminNote: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ReturnRequestSelect;

type ReturnRequestRow = Prisma.ReturnRequestGetPayload<{ select: typeof RETURN_REQUEST_SELECT }>;

@Injectable()
export class ReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, dto: CreateReturnRequestDto): Promise<ReturnRequestEntity> {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, userId },
      select: { status: true },
    });

    if (!order) {
      throw new NotFoundException('Order does not exist for the current user.');
    }
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Only delivered orders are eligible for a return request.');
    }

    // Order.returnRequest is @unique — a second return request for the same
    // order hits that constraint (P2002 → 409), translated by
    // PrismaClientExceptionFilter, no manual pre-check needed.
    const returnRequest = await this.prisma.returnRequest.create({
      data: { orderId: dto.orderId, userId, reason: dto.reason },
      select: RETURN_REQUEST_SELECT,
    });

    return this.toEntity(returnRequest);
  }

  async findAll(
    requester: AuthUser,
    query: ReturnQueryDto,
  ): Promise<PaginatedReturnRequestsEntity> {
    const isStaff = requester.role === Role.ADMIN || requester.role === Role.SUPER_ADMIN;
    const where: Prisma.ReturnRequestWhereInput = {};

    if (!isStaff) {
      where.userId = requester.id;
    } else if (query.userId !== undefined) {
      where.userId = query.userId;
    }

    if (query.status !== undefined) {
      where.status = query.status;
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.returnRequest.findMany({
        where,
        select: RETURN_REQUEST_SELECT,
        orderBy: { createdAt: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.returnRequest.count({ where }),
    ]);

    return new PaginatedReturnRequestsEntity({
      items: rows.map((row) => this.toEntity(row)),
      meta: new PaginationMetaEntity({
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      }),
    });
  }

  async findOne(requester: AuthUser, id: number): Promise<ReturnRequestEntity> {
    const isStaff = requester.role === Role.ADMIN || requester.role === Role.SUPER_ADMIN;

    const returnRequest = await this.prisma.returnRequest.findFirst({
      where: { id, ...(isStaff ? {} : { userId: requester.id }) },
      select: RETURN_REQUEST_SELECT,
    });

    if (!returnRequest) {
      throw new NotFoundException('Return request does not exist.');
    }

    return this.toEntity(returnRequest);
  }

  async updateStatus(id: number, dto: UpdateReturnStatusDto): Promise<ReturnRequestEntity> {
    if (dto.status !== ReturnStatus.REFUNDED) {
      const returnRequest = await this.prisma.returnRequest.update({
        where: { id },
        data: { status: dto.status, adminNote: dto.adminNote },
        select: RETURN_REQUEST_SELECT,
      });

      return this.toEntity(returnRequest);
    }

    // Marking a return REFUNDED also reflects that outcome on the parent
    // order — both writes commit or roll back together, mirroring the
    // Payment.status → Order.paymentStatus sync in PaymentsService.
    const returnRequest = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.returnRequest.update({
        where: { id },
        data: { status: dto.status, adminNote: dto.adminNote },
        select: RETURN_REQUEST_SELECT,
      });

      await tx.order.update({
        where: { id: updated.orderId },
        data: { status: OrderStatus.RETURNED, paymentStatus: PaymentStatus.REFUNDED },
        select: { id: true },
      });

      return updated;
    });

    return this.toEntity(returnRequest);
  }

  private toEntity(returnRequest: ReturnRequestRow): ReturnRequestEntity {
    return new ReturnRequestEntity({
      id: returnRequest.id,
      orderId: returnRequest.orderId,
      userId: returnRequest.userId,
      reason: returnRequest.reason,
      status: returnRequest.status,
      adminNote: returnRequest.adminNote,
      createdAt: returnRequest.createdAt,
      updatedAt: returnRequest.updatedAt,
    });
  }
}
