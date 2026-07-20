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
import { ReturnsService } from './returns.service';
import {
  CreateReturnRequestSchema,
  type CreateReturnRequestDto,
} from './dto/create-return-request.dto';
import {
  UpdateReturnStatusSchema,
  type UpdateReturnStatusDto,
} from './dto/update-return-status.dto';
import { ReturnQuerySchema, type ReturnQueryDto } from './dto/query-return.dto';
import {
  PaginatedReturnRequestsEntity,
  ReturnRequestEntity,
} from './entities/return-request.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

@ApiTags('Returns')
@ApiBearerAuth()
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a return request for a delivered order' })
  @ApiBody({ schema: z.toJSONSchema(CreateReturnRequestSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: ReturnRequestEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Order is not delivered yet' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Order does not exist for the current user',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'A return request already exists for this order',
  })
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateReturnRequestSchema)) dto: CreateReturnRequestDto,
  ): Promise<{ message: string; data: ReturnRequestEntity }> {
    const returnRequest = await this.returnsService.create(user.id, dto);
    return { message: 'Return request submitted successfully', data: returnRequest };
  }

  @Get()
  @ApiOperation({
    summary: "List return requests — the caller's own, or every request for ADMIN/SUPER_ADMIN",
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'REFUNDED'],
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: Number,
    description: 'ADMIN/SUPER_ADMIN only — filter by a specific customer',
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedReturnRequestsEntity })
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(ReturnQuerySchema)) query: ReturnQueryDto,
  ): Promise<{ message: string; data: PaginatedReturnRequestsEntity }> {
    const result = await this.returnsService.findAll(user, query);
    return { message: 'Return requests retrieved successfully', data: result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a single return request (own, or any for ADMIN/SUPER_ADMIN)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: ReturnRequestEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Return request does not exist' })
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: ReturnRequestEntity }> {
    const returnRequest = await this.returnsService.findOne(user, id);
    return { message: 'Return request retrieved successfully', data: returnRequest };
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: "Update a return request's status; REFUNDED also marks the order returned/refunded",
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: z.toJSONSchema(UpdateReturnStatusSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: ReturnRequestEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Return request does not exist' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateReturnStatusSchema)) dto: UpdateReturnStatusDto,
  ): Promise<{ message: string; data: ReturnRequestEntity }> {
    const returnRequest = await this.returnsService.updateStatus(id, dto);
    return { message: 'Return request status updated successfully', data: returnRequest };
  }
}
