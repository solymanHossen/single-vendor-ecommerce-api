import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { WishlistService } from './wishlist.service';
import {
  CreateWishlistItemSchema,
  type CreateWishlistItemDto,
} from './dto/create-wishlist-item.dto';
import { WishlistItemEntity } from './entities/wishlist-item.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

@ApiTags('Wishlist')
@ApiBearerAuth()
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's wishlist" })
  @ApiResponse({ status: HttpStatus.OK, type: WishlistItemEntity, isArray: true })
  async findAll(
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: WishlistItemEntity[] }> {
    const items = await this.wishlistService.findAll(user.id);
    return { message: 'Wishlist retrieved successfully', data: items };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add a product to the current user's wishlist" })
  @ApiBody({ schema: z.toJSONSchema(CreateWishlistItemSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: WishlistItemEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Product is already in the wishlist' })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'productId references a product that does not exist',
  })
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateWishlistItemSchema)) dto: CreateWishlistItemDto,
  ): Promise<{ message: string; data: WishlistItemEntity }> {
    const item = await this.wishlistService.create(user.id, dto);
    return { message: 'Product added to wishlist successfully', data: item };
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove a product from the current user's wishlist" })
  @ApiParam({ name: 'productId', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product removed from wishlist successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product is not in the wishlist' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('productId', ParseIntPipe) productId: number,
  ): Promise<{ message: string; data: null }> {
    await this.wishlistService.remove(user.id, productId);
    return { message: 'Product removed from wishlist successfully', data: null };
  }
}
