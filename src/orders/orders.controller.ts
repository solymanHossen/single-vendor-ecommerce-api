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
import { Role } from '@prisma/client';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { OrdersService } from './orders.service';
import { PlaceOrderSchema, type PlaceOrderDto } from './dto/place-order.dto';
import { OrderQuerySchema, type OrderQueryDto } from './dto/query-order.dto';
import { UpdateOrderStatusSchema, type UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderEntity, PaginatedOrdersEntity } from './entities/order.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Place an order from the current user's cart" })
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

  @Patch(':id/status')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: "Update an order's status" })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: z.toJSONSchema(UpdateOrderStatusSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: OrderEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Order does not exist' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateOrderStatusSchema)) dto: UpdateOrderStatusDto,
  ): Promise<{ message: string; data: OrderEntity }> {
    const order = await this.ordersService.updateStatus(id, dto);
    return { message: 'Order status updated successfully', data: order };
  }
}
