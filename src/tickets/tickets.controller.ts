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
import { TicketsService } from './tickets.service';
import { CreateTicketSchema, type CreateTicketDto } from './dto/create-ticket.dto';
import {
  CreateTicketMessageSchema,
  type CreateTicketMessageDto,
} from './dto/create-ticket-message.dto';
import {
  UpdateTicketStatusSchema,
  type UpdateTicketStatusDto,
} from './dto/update-ticket-status.dto';
import { TicketQuerySchema, type TicketQueryDto } from './dto/query-ticket.dto';
import { PaginatedTicketsEntity, TicketEntity } from './entities/ticket.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

@ApiTags('Tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Open a new support ticket with its first message' })
  @ApiBody({ schema: z.toJSONSchema(CreateTicketSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: TicketEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'orderId does not belong to the current user',
  })
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateTicketSchema)) dto: CreateTicketDto,
  ): Promise<{ message: string; data: TicketEntity }> {
    const ticket = await this.ticketsService.create(user.id, dto);
    return { message: 'Ticket created successfully', data: ticket };
  }

  @Get()
  @ApiOperation({
    summary: "List tickets — the caller's own, or every ticket for ADMIN/SUPER_ADMIN",
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: ['OPEN', 'IN_PROGRESS', 'CLOSED'] })
  @ApiQuery({ name: 'priority', required: false, enum: ['LOW', 'MEDIUM', 'HIGH'] })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: Number,
    description: 'ADMIN/SUPER_ADMIN only — filter by a specific customer',
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedTicketsEntity })
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(TicketQuerySchema)) query: TicketQueryDto,
  ): Promise<{ message: string; data: PaginatedTicketsEntity }> {
    const result = await this.ticketsService.findAll(user, query);
    return { message: 'Tickets retrieved successfully', data: result };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Retrieve a ticket with its full message thread (own, or any for ADMIN/SUPER_ADMIN)',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: TicketEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Ticket does not exist' })
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: TicketEntity }> {
    const ticket = await this.ticketsService.findOne(user, id);
    return { message: 'Ticket retrieved successfully', data: ticket };
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a message to the ticket thread (owner or ADMIN/SUPER_ADMIN)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: z.toJSONSchema(CreateTicketMessageSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: TicketEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Ticket does not exist' })
  async addMessage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(CreateTicketMessageSchema)) dto: CreateTicketMessageDto,
  ): Promise<{ message: string; data: TicketEntity }> {
    const ticket = await this.ticketsService.addMessage(user, id, dto);
    return { message: 'Message added successfully', data: ticket };
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: "Update a ticket's status (e.g. close it)" })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: z.toJSONSchema(UpdateTicketStatusSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: TicketEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Ticket does not exist' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateTicketStatusSchema)) dto: UpdateTicketStatusDto,
  ): Promise<{ message: string; data: TicketEntity }> {
    const ticket = await this.ticketsService.updateStatus(id, dto);
    return { message: 'Ticket status updated successfully', data: ticket };
  }
}
