import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AUTH_THROTTLE_KEY, CHECKOUT_THROTTLE_KEY } from '../common/constants/throttler.constants';
import { CouponsService } from './coupons.service';
import { CreateCouponSchema, type CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponSchema, type UpdateCouponDto } from './dto/update-coupon.dto';
import { CouponQuerySchema, type CouponQueryDto } from './dto/query-coupon.dto';
import { ValidateCouponSchema, type ValidateCouponDto } from './dto/validate-coupon.dto';
import {
  CouponDetailEntity,
  CouponEntity,
  CouponSummaryEntity,
  CouponValidationEntity,
  PaginatedCouponsEntity,
} from './entities/coupon.entity';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { COUPON_STATUSES } from './coupons.constants';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

@ApiTags('Coupons')
@ApiBearerAuth()
// Every registered throttler tier applies to every route by default unless
// explicitly skipped (see HealthController for the same gotcha, verified
// live there) — none of these endpoints are login-like, so the "auth" tier's
// far stricter 10-req/15-min default must not silently bind ahead of the
// "checkout" tier's own (looser) limit on validate() below.
@SkipThrottle({ [AUTH_THROTTLE_KEY]: true })
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  @RequirePermissions('coupons.manage')
  @ApiOperation({ summary: 'List coupons with filtering, sorting, and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Filter by coupon code' })
  @ApiQuery({ name: 'isActive', required: false, enum: ['true', 'false'] })
  @ApiQuery({ name: 'status', required: false, enum: COUPON_STATUSES })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'validUntil', 'usedCount', 'code'],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedCouponsEntity })
  async findAll(
    @Query(new ZodValidationPipe(CouponQuerySchema)) query: CouponQueryDto,
  ): Promise<{ message: string; data: PaginatedCouponsEntity }> {
    const result = await this.couponsService.findAll(query);
    return { message: 'Coupons retrieved successfully', data: result };
  }

  // Declared before ':id' so "summary" isn't parsed as an id.
  @Get('summary')
  @RequirePermissions('coupons.manage')
  @ApiOperation({ summary: 'Coupon counts by status and what coupons have earned' })
  @ApiResponse({ status: HttpStatus.OK, type: CouponSummaryEntity })
  async summary(): Promise<{ message: string; data: CouponSummaryEntity }> {
    return {
      message: 'Coupon summary retrieved successfully',
      data: await this.couponsService.summary(),
    };
  }

  @Get(':id')
  @RequirePermissions('coupons.manage')
  @ApiOperation({ summary: 'Retrieve a single coupon with its usage and recent orders' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: CouponDetailEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Coupon does not exist' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: CouponDetailEntity }> {
    const coupon = await this.couponsService.findOne(id);
    return { message: 'Coupon retrieved successfully', data: coupon };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('coupons.manage')
  @ApiOperation({ summary: 'Create a new coupon' })
  @ApiBody({
    schema: z.toJSONSchema(CreateCouponSchema, { io: 'input' }) as unknown as ApiBodySchema,
  })
  @ApiResponse({ status: HttpStatus.CREATED, type: CouponEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Code already exists' })
  async create(
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
    @Body(new ZodValidationPipe(CreateCouponSchema)) dto: CreateCouponDto,
  ): Promise<{ message: string; data: CouponEntity }> {
    const coupon = await this.couponsService.create(dto, { actor, ip });
    return { message: 'Coupon created successfully', data: coupon };
  }

  @Patch(':id')
  @RequirePermissions('coupons.manage')
  @ApiOperation({ summary: 'Update an existing coupon' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: z.toJSONSchema(UpdateCouponSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: CouponEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Coupon does not exist' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Code already exists' })
  async update(
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateCouponSchema)) dto: UpdateCouponDto,
  ): Promise<{ message: string; data: CouponEntity }> {
    const coupon = await this.couponsService.update(id, dto, { actor, ip });
    return { message: 'Coupon updated successfully', data: coupon };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('coupons.manage')
  @ApiOperation({ summary: 'Delete a coupon' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Coupon deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Coupon does not exist' })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Coupon is on orders — switch it off instead',
  })
  async remove(
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: null }> {
    await this.couponsService.remove(id, { actor, ip });
    return { message: 'Coupon deleted successfully', data: null };
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @Throttle({ [CHECKOUT_THROTTLE_KEY]: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: "Validate a coupon code against the current user's cart" })
  @ApiBody({ schema: z.toJSONSchema(ValidateCouponSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: CouponValidationEntity })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Coupon cannot be applied right now',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Coupon code is invalid' })
  async validate(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(ValidateCouponSchema)) dto: ValidateCouponDto,
  ): Promise<{ message: string; data: CouponValidationEntity }> {
    const result = await this.couponsService.validate(user.id, dto);
    return { message: 'Coupon is valid', data: result };
  }
}
