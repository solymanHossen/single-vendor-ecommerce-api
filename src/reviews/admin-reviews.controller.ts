import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { ReviewsService } from './reviews.service';
import {
  AdminReviewQuerySchema,
  ModerateReviewSchema,
  type AdminReviewQueryDto,
  type ModerateReviewDto,
} from './dto/query-review.dto';
import { ReplyReviewSchema, type ReplyReviewDto } from './dto/reply-review.dto';
import { AdminReviewEntity, PaginatedAdminReviewsEntity } from './entities/review.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];
const bodySchema = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as unknown as ApiBodySchema;

@ApiTags('Reviews (admin)')
@ApiBearerAuth()
@RequirePermissions('reviews.moderate')
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'Reviews by status, with counts per status' })
  @ApiResponse({ status: 200, type: PaginatedAdminReviewsEntity })
  async findAll(
    @Query(new ZodValidationPipe(AdminReviewQuerySchema)) query: AdminReviewQueryDto,
  ): Promise<{ message: string; data: PaginatedAdminReviewsEntity }> {
    return {
      message: 'Reviews retrieved successfully',
      data: await this.reviews.findAllForAdmin(query),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Publish or hide a review' })
  @ApiBody({ schema: bodySchema(ModerateReviewSchema) })
  async moderate(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(ModerateReviewSchema)) dto: ModerateReviewDto,
  ): Promise<{ message: string; data: AdminReviewEntity }> {
    return {
      message: dto.status === 'PUBLISHED' ? 'Review published' : 'Review hidden',
      data: await this.reviews.moderate(id, dto),
    };
  }

  @Put(':id/reply')
  @ApiOperation({ summary: 'Add or replace the store’s public response' })
  @ApiBody({ schema: bodySchema(ReplyReviewSchema) })
  async reply(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(ReplyReviewSchema)) dto: ReplyReviewDto,
  ): Promise<{ message: string; data: AdminReviewEntity }> {
    return { message: 'Response saved', data: await this.reviews.reply(user.id, id, dto) };
  }

  @Delete(':id/reply')
  @ApiOperation({ summary: 'Remove the store’s response' })
  async removeReply(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: AdminReviewEntity }> {
    return { message: 'Response removed', data: await this.reviews.removeReply(id) };
  }
}
