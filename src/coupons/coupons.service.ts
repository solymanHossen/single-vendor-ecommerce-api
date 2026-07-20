import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CartsService } from '../carts/carts.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { CouponQueryDto } from './dto/query-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import {
  CouponEntity,
  CouponValidationEntity,
  PaginatedCouponsEntity,
  PaginationMetaEntity,
} from './entities/coupon.entity';

const COUPON_SELECT = {
  id: true,
  code: true,
  discountType: true,
  discountValue: true,
  minOrderAmount: true,
  maxDiscountAmount: true,
  usageLimit: true,
  usedCount: true,
  validFrom: true,
  validUntil: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CouponSelect;

type CouponRow = Prisma.CouponGetPayload<{ select: typeof COUPON_SELECT }>;

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartsService: CartsService,
  ) {}

  async findAll(query: CouponQueryDto): Promise<PaginatedCouponsEntity> {
    const where = this.buildWhere(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.coupon.findMany({
        where,
        select: COUPON_SELECT,
        orderBy: { createdAt: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.coupon.count({ where }),
    ]);

    return new PaginatedCouponsEntity({
      items: rows.map((row) => this.toEntity(row)),
      meta: new PaginationMetaEntity({
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      }),
    });
  }

  async findOne(id: number): Promise<CouponEntity> {
    const coupon = await this.prisma.coupon.findUniqueOrThrow({
      where: { id },
      select: COUPON_SELECT,
    });

    return this.toEntity(coupon);
  }

  async create(dto: CreateCouponDto): Promise<CouponEntity> {
    const coupon = await this.prisma.coupon.create({
      data: { ...dto, code: dto.code.toUpperCase() },
      select: COUPON_SELECT,
    });

    return this.toEntity(coupon);
  }

  async update(id: number, dto: UpdateCouponDto): Promise<CouponEntity> {
    const { code, ...rest } = dto;

    const coupon = await this.prisma.coupon.update({
      where: { id },
      data: code !== undefined ? { ...rest, code: code.toUpperCase() } : rest,
      select: COUPON_SELECT,
    });

    return this.toEntity(coupon);
  }

  async remove(id: number): Promise<void> {
    await this.prisma.coupon.delete({ where: { id } });
  }

  async validate(userId: number, dto: ValidateCouponDto): Promise<CouponValidationEntity> {
    const code = dto.code.toUpperCase();

    const coupon = await this.prisma.coupon.findUnique({
      where: { code },
      select: COUPON_SELECT,
    });

    // Non-existent and deactivated codes report the exact same generic
    // message — this endpoint is rate-limited specifically because a coupon
    // code is a guessable secret, so we don't want to hand back a channel
    // ("this one used to exist") that helps an attacker narrow down real codes.
    if (!coupon || !coupon.isActive) {
      throw new NotFoundException('Coupon code is invalid.');
    }

    const now = new Date();

    if (now < coupon.validFrom) {
      throw new BadRequestException('This coupon is not active yet.');
    }
    if (now > coupon.validUntil) {
      throw new BadRequestException('This coupon has expired.');
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('This coupon has reached its usage limit.');
    }

    const cart = await this.cartsService.getCart({ type: 'user', id: userId });

    if (cart.items.length === 0) {
      throw new BadRequestException('Cannot validate a coupon with an empty cart.');
    }

    const orderAmount = cart.totalPrice;

    if (coupon.minOrderAmount !== null && orderAmount.lessThan(coupon.minOrderAmount)) {
      throw new BadRequestException(
        `This coupon requires a minimum order amount of ${coupon.minOrderAmount.toString()}.`,
      );
    }

    let discountAmount =
      coupon.discountType === 'PERCENTAGE'
        ? orderAmount.times(coupon.discountValue).dividedBy(100)
        : coupon.discountValue;

    if (coupon.maxDiscountAmount !== null && discountAmount.greaterThan(coupon.maxDiscountAmount)) {
      discountAmount = coupon.maxDiscountAmount;
    }
    if (discountAmount.greaterThan(orderAmount)) {
      discountAmount = orderAmount;
    }

    return new CouponValidationEntity({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
      orderAmount,
    });
  }

  private buildWhere(query: CouponQueryDto): Prisma.CouponWhereInput {
    const where: Prisma.CouponWhereInput = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search !== undefined) {
      where.code = { contains: query.search, mode: 'insensitive' };
    }

    return where;
  }

  private toEntity(coupon: CouponRow): CouponEntity {
    return new CouponEntity({
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderAmount: coupon.minOrderAmount,
      maxDiscountAmount: coupon.maxDiscountAmount,
      usageLimit: coupon.usageLimit,
      usedCount: coupon.usedCount,
      validFrom: coupon.validFrom,
      validUntil: coupon.validUntil,
      isActive: coupon.isActive,
      createdAt: coupon.createdAt,
      updatedAt: coupon.updatedAt,
    });
  }
}
