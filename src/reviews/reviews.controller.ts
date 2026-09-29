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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { GLOBAL_THROTTLE_KEY } from '../common/constants/throttler.constants';
import { ReviewsService } from './reviews.service';
import {
  CreateReviewSchema,
  UpdateReviewSchema,
  type CreateReviewDto,
  type UpdateReviewDto,
} from './dto/create-review.dto';
import { ReviewQuerySchema, type ReviewQueryDto } from './dto/query-review.dto';
import {
  MyReviewStatusEntity,
  OwnReviewEntity,
  ProductReviewsEntity,
} from './entities/review.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];
const bodySchema = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as unknown as ApiBodySchema;

@ApiTags('Reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('products/:productId/reviews')
  @Public()
  @ApiOperation({ summary: 'Published reviews for a product, with the rating summary' })
  @ApiResponse({ status: HttpStatus.OK, type: ProductReviewsEntity })
  async findAllForProduct(
    @Param('productId', ParseIntPipe) productId: number,
    @Query(new ZodValidationPipe(ReviewQuerySchema)) query: ReviewQueryDto,
  ): Promise<{ message: string; data: ProductReviewsEntity }> {
    return {
      message: 'Reviews retrieved successfully',
      data: await this.reviewsService.findAllForProduct(productId, query),
    };
  }

  @Get('products/:productId/reviews/me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Whether you can review this product, your review, and your helpful votes',
  })
  @ApiResponse({ status: HttpStatus.OK, type: MyReviewStatusEntity })
  async myStatus(
    @CurrentUser() user: AuthUser,
    @Param('productId', ParseIntPipe) productId: number,
  ): Promise<{ message: string; data: MyReviewStatusEntity }> {
    return {
      message: 'Review status retrieved successfully',
      data: await this.reviewsService.myStatus(user.id, productId),
    };
  }

  @Get('reviews/mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Your reviews (all statuses)' })
  @ApiResponse({ status: HttpStatus.OK, type: OwnReviewEntity, isArray: true })
  async mine(@CurrentUser() user: AuthUser): Promise<{ message: string; data: OwnReviewEntity[] }> {
    return {
      message: 'Reviews retrieved successfully',
      data: await this.reviewsService.mine(user.id),
    };
  }

  @Post('reviews')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @Throttle({ [GLOBAL_THROTTLE_KEY]: { limit: 10, ttl: 10 * 60_000 } })
  @ApiOperation({ summary: 'Review a product from a delivered order (one per product)' })
  @ApiBody({ schema: bodySchema(CreateReviewSchema) })
  @ApiResponse({ status: HttpStatus.CREATED, type: OwnReviewEntity })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'No delivered order contains this product',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'You have already reviewed this product',
  })
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateReviewSchema)) dto: CreateReviewDto,
  ): Promise<{ message: string; data: OwnReviewEntity }> {
    return { message: 'Review published', data: await this.reviewsService.create(user.id, dto) };
  }

  @Patch('reviews/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit your review' })
  @ApiBody({ schema: bodySchema(UpdateReviewSchema) })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateReviewSchema)) dto: UpdateReviewDto,
  ): Promise<{ message: string; data: OwnReviewEntity }> {
    return { message: 'Review updated', data: await this.reviewsService.update(user.id, id, dto) };
  }

  @Delete('reviews/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete your review' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: null }> {
    await this.reviewsService.remove(user.id, id);
    return { message: 'Review deleted', data: null };
  }

  @Post('reviews/:id/helpful')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Throttle({ [GLOBAL_THROTTLE_KEY]: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Mark a review helpful, or undo it' })
  async toggleHelpful(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: { helpful: boolean; helpfulCount: number } }> {
    return { message: 'Vote saved', data: await this.reviewsService.toggleHelpful(user.id, id) };
  }
}
