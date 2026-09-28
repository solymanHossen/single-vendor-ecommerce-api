import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { GLOBAL_THROTTLE_KEY } from '../common/constants/throttler.constants';
import { TicketsService } from './tickets.service';
import { CreateTicketSchema, type CreateTicketDto } from './dto/create-ticket.dto';
import {
  CreateTicketMessageSchema,
  RateTicketSchema,
  type CreateTicketMessageDto,
  type RateTicketDto,
} from './dto/create-ticket-message.dto';
import { TicketQuerySchema, type TicketQueryDto } from './dto/query-ticket.dto';
import { PaginatedTicketsEntity, TicketDetailEntity } from './entities/ticket.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];
const bodySchema = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as unknown as ApiBodySchema;

/** The signed-in customer's own support requests. Staff use /admin/tickets. */
@ApiTags('Support')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  // Stops a loop or a bot from flooding the support queue.
  @Throttle({ [GLOBAL_THROTTLE_KEY]: { limit: 5, ttl: 10 * 60_000 } })
  @ApiOperation({ summary: 'Open a support request' })
  @ApiBody({ schema: bodySchema(CreateTicketSchema) })
  @ApiResponse({ status: HttpStatus.CREATED, type: TicketDetailEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'orderId is not one of your orders' })
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateTicketSchema)) dto: CreateTicketDto,
  ): Promise<{ message: string; data: TicketDetailEntity }> {
    return { message: 'Request sent', data: await this.ticketsService.create(user, dto) };
  }

  @Get()
  @ApiOperation({ summary: 'Your support requests, most recent activity first' })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedTicketsEntity })
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(TicketQuerySchema)) query: TicketQueryDto,
  ): Promise<{ message: string; data: PaginatedTicketsEntity }> {
    return {
      message: 'Tickets retrieved successfully',
      data: await this.ticketsService.findAll(user, query),
    };
  }

  // Declared before ':id' so "unread-count" isn't parsed as an id.
  @Get('unread-count')
  @ApiOperation({ summary: 'How many of your requests have a reply you haven’t read' })
  async unreadCount(
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: { count: number } }> {
    return {
      message: 'Unread count retrieved successfully',
      data: { count: await this.ticketsService.unreadCount(user.id) },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'A request with its conversation (marks replies as read)' })
  @ApiResponse({ status: HttpStatus.OK, type: TicketDetailEntity })
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: TicketDetailEntity }> {
    return {
      message: 'Ticket retrieved successfully',
      data: await this.ticketsService.findOne(user, id),
    };
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ [GLOBAL_THROTTLE_KEY]: { limit: 30, ttl: 10 * 60_000 } })
  @ApiOperation({ summary: 'Reply to your request (reopens it if resolved)' })
  @ApiBody({ schema: bodySchema(CreateTicketMessageSchema) })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'The request is closed' })
  async addMessage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(CreateTicketMessageSchema)) dto: CreateTicketMessageDto,
  ): Promise<{ message: string; data: TicketDetailEntity }> {
    return { message: 'Message sent', data: await this.ticketsService.addMessage(user, id, dto) };
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark your request as resolved' })
  async resolve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: TicketDetailEntity }> {
    return { message: 'Marked as resolved', data: await this.ticketsService.resolve(user, id) };
  }

  @Post(':id/rating')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Say whether the help was useful (resolved requests only)' })
  @ApiBody({ schema: bodySchema(RateTicketSchema) })
  async rate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(RateTicketSchema)) dto: RateTicketDto,
  ): Promise<{ message: string; data: TicketDetailEntity }> {
    return {
      message: 'Thanks for the feedback',
      data: await this.ticketsService.rate(user, id, dto),
    };
  }
}
