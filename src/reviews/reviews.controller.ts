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
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ReviewsService } from './reviews.service';
import { CreateReviewSchema, type CreateReviewDto } from './dto/create-review.dto';
import { ReplyReviewSchema, type ReplyReviewDto } from './dto/reply-review.dto';
import { ReviewQuerySchema, type ReviewQueryDto } from './dto/query-review.dto';
import { PaginatedReviewsEntity, ReviewEntity } from './entities/review.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

@ApiTags('Reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('products/:productId/reviews')
  @Public()
  @ApiOperation({ summary: 'List approved reviews for a product' })
  @ApiParam({ name: 'productId', type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedReviewsEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product does not exist' })
  async findAllForProduct(
    @Param('productId', ParseIntPipe) productId: number,
    @Query(new ZodValidationPipe(ReviewQuerySchema)) query: ReviewQueryDto,
  ): Promise<{ message: string; data: PaginatedReviewsEntity }> {
    const result = await this.reviewsService.findAllForProduct(productId, query);
    return { message: 'Reviews retrieved successfully', data: result };
  }

  @Post('reviews')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a review for a product you have purchased and received' })
  @ApiBody({ schema: z.toJSONSchema(CreateReviewSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: ReviewEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'No delivered order containing this product was found for the current user',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'You have already reviewed this product',
  })
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateReviewSchema)) dto: CreateReviewDto,
  ): Promise<{ message: string; data: ReviewEntity }> {
    const review = await this.reviewsService.create(user.id, dto);
    return { message: 'Review submitted successfully', data: review };
  }

  @Get('reviews')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List every review, including unapproved ones, for moderation' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'productId', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false, type: Number })
  @ApiQuery({ name: 'isApproved', required: false, enum: ['true', 'false'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedReviewsEntity })
  async findAllForAdmin(
    @Query(new ZodValidationPipe(ReviewQuerySchema)) query: ReviewQueryDto,
  ): Promise<{ message: string; data: PaginatedReviewsEntity }> {
    const result = await this.reviewsService.findAllForAdmin(query);
    return { message: 'Reviews retrieved successfully', data: result };
  }

  @Patch('reviews/:id/approve')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve a review, making it publicly visible' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: ReviewEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Review does not exist' })
  async approve(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: ReviewEntity }> {
    const review = await this.reviewsService.approve(id);
    return { message: 'Review approved successfully', data: review };
  }

  @Post('reviews/:id/reply')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reply to a review' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: z.toJSONSchema(ReplyReviewSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: ReviewEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Review already has a reply' })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'id references a review that does not exist',
  })
  async reply(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(ReplyReviewSchema)) dto: ReplyReviewDto,
  ): Promise<{ message: string; data: ReviewEntity }> {
    const review = await this.reviewsService.reply(user.id, id, dto);
    return { message: 'Reply added successfully', data: review };
  }
}
