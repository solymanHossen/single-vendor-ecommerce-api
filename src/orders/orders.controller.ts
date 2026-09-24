import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CHECKOUT_THROTTLE_KEY } from '../common/constants/throttler.constants';
import { OrdersService } from './orders.service';
import { PlaceOrderSchema, type PlaceOrderDto } from './dto/place-order.dto';
import { OrderQuerySchema, type OrderQueryDto } from './dto/query-order.dto';
import { QuoteOrderSchema, type QuoteOrderDto } from './dto/quote-order.dto';
import { UpdateOrderStatusSchema, type UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderEntity, OrderQuoteEntity, PaginatedOrdersEntity } from './entities/order.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  // Accepts coupon codes, which are guessable secrets — same limit as /coupons/validate.
  @Throttle({ [CHECKOUT_THROTTLE_KEY]: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: "Price the current user's cart for checkout (coupon, shipping, total)",
    description: 'Read-only. An invalid coupon is reported in couponError rather than failing.',
  })
  @ApiBody({ schema: z.toJSONSchema(QuoteOrderSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: OrderQuoteEntity })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'addressId does not belong to the current user',
  })
  async quote(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(QuoteOrderSchema)) dto: QuoteOrderDto,
  ): Promise<{ message: string; data: OrderQuoteEntity }> {
    const data = await this.ordersService.quote(user.id, dto);
    return { message: 'Quote calculated successfully', data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ [CHECKOUT_THROTTLE_KEY]: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: "Place a cash-on-delivery order from the current user's cart",
    description:
      'Re-prices the cart, applies the coupon, decrements stock atomically and clears the cart.',
  })
  @ApiBody({ schema: z.toJSONSchema(PlaceOrderSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: OrderEntity })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed, or the cart is empty',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'addressId does not belong to the current user',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'One or more cart items are unavailable or out of stock',
  })
  async placeOrder(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(PlaceOrderSchema)) dto: PlaceOrderDto,
  ): Promise<{ message: string; data: OrderEntity }> {
    const order = await this.ordersService.placeOrder(user.id, dto);
    return { message: 'Order placed successfully', data: order };
  }

  @Get()
  @ApiOperation({
    summary: "List orders — the caller's own order history, or every order for ADMIN/SUPER_ADMIN",
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'],
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: Number,
    description: 'ADMIN/SUPER_ADMIN only — filter by a specific customer',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'ADMIN/SUPER_ADMIN only — order id ("#123") or customer name, email, phone',
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedOrdersEntity })
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(OrderQuerySchema)) query: OrderQueryDto,
  ): Promise<{ message: string; data: PaginatedOrdersEntity }> {
    const result = await this.ordersService.findAll(user, query);
    return { message: 'Orders retrieved successfully', data: result };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Retrieve a single order (own order, or any order for ADMIN/SUPER_ADMIN)',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: OrderEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Order does not exist' })
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: OrderEntity }> {
    const order = await this.ordersService.findOne(user, id);
    return { message: 'Order retrieved successfully', data: order };
  }

  @Patch(':id/cancel')
  @ApiOperation({
    summary: 'Cancel your own order while it is still pending',
    description: 'Puts the items back in stock and releases the coupon.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: OrderEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Order is past the pending stage' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Order does not exist' })
  async cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: OrderEntity }> {
    const order = await this.ordersService.cancel(user, id);
    return { message: 'Order cancelled successfully', data: order };
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: "Update an order's status" })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: z.toJSONSchema(UpdateOrderStatusSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: OrderEntity })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed, or the transition is not allowed',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Order does not exist' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'The order changed concurrently' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateOrderStatusSchema)) dto: UpdateOrderStatusDto,
  ): Promise<{ message: string; data: OrderEntity }> {
    const order = await this.ordersService.updateStatus(id, dto);
    return { message: 'Order status updated successfully', data: order };
  }
}
