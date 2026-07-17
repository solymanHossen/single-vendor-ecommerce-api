import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Public } from '../auth/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SESSION_ID_HEADER } from './carts.constants';
import { CartsService } from './carts.service';
import { CurrentCart } from './decorators/cart-identity.decorator';
import { AddCartItemSchema, type AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemSchema, type UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartEntity } from './entities/cart.entity';
import type { CartIdentity } from './interfaces/cart-identity.interface';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

@ApiTags('Cart')
@ApiHeader({
  name: SESSION_ID_HEADER,
  required: false,
  description:
    'Identifies a guest cart. Required when no Bearer token is sent; ignored for authenticated requests.',
})
@Public()
@UseGuards(OptionalJwtAuthGuard)
@Controller('cart')
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Get()
  @ApiOperation({ summary: 'Get the current cart (authenticated user or guest session)' })
  @ApiResponse({ status: HttpStatus.OK, type: CartEntity })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Missing x-session-id header for a guest request',
  })
  async getCart(
    @CurrentCart() identity: CartIdentity,
  ): Promise<{ message: string; data: CartEntity }> {
    const cart = await this.cartsService.getCart(identity);
    return { message: 'Cart retrieved successfully', data: cart };
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a product to the cart, incrementing its quantity if already present',
  })
  @ApiBody({ schema: z.toJSONSchema(AddCartItemSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: CartEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product does not exist or is not published',
  })
  async addItem(
    @CurrentCart() identity: CartIdentity,
    @Body(new ZodValidationPipe(AddCartItemSchema)) dto: AddCartItemDto,
  ): Promise<{ message: string; data: CartEntity }> {
    const cart = await this.cartsService.addItem(identity, dto);
    return { message: 'Item added to cart successfully', data: cart };
  }

  @Patch('items/:productId')
  @ApiOperation({ summary: 'Set the exact quantity of an item already in the cart' })
  @ApiParam({ name: 'productId', type: Number })
  @ApiBody({ schema: z.toJSONSchema(UpdateCartItemSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: CartEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product is not in the cart' })
  async updateItemQuantity(
    @CurrentCart() identity: CartIdentity,
    @Param('productId', ParseIntPipe) productId: number,
    @Body(new ZodValidationPipe(UpdateCartItemSchema)) dto: UpdateCartItemDto,
  ): Promise<{ message: string; data: CartEntity }> {
    const cart = await this.cartsService.updateItemQuantity(identity, productId, dto);
    return { message: 'Cart item updated successfully', data: cart };
  }

  @Delete('items/:productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a single item from the cart' })
  @ApiParam({ name: 'productId', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: CartEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product is not in the cart' })
  async removeItem(
    @CurrentCart() identity: CartIdentity,
    @Param('productId', ParseIntPipe) productId: number,
  ): Promise<{ message: string; data: CartEntity }> {
    const cart = await this.cartsService.removeItem(identity, productId);
    return { message: 'Item removed from cart successfully', data: cart };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove every item from the cart' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Cart cleared successfully' })
  async clearCart(@CurrentCart() identity: CartIdentity): Promise<{ message: string; data: null }> {
    await this.cartsService.clearCart(identity);
    return { message: 'Cart cleared successfully', data: null };
  }
}
