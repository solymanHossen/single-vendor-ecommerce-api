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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { AdminTicketsService } from './admin-tickets.service';
import { AdminTicketQuerySchema, type AdminTicketQueryDto } from './dto/query-ticket.dto';
import {
  StaffTicketMessageSchema,
  type StaffTicketMessageDto,
} from './dto/create-ticket-message.dto';
import { UpdateTicketSchema, type UpdateTicketDto } from './dto/update-ticket.dto';
import {
  PaginatedTicketsEntity,
  TicketDetailEntity,
  TicketPersonEntity,
  TicketSummaryEntity,
} from './entities/ticket.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];
const bodySchema = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as unknown as ApiBodySchema;

@ApiTags('Support (admin)')
@ApiBearerAuth()
@RequirePermissions('tickets.manage')
@Controller('admin/tickets')
export class AdminTicketsController {
  constructor(private readonly tickets: AdminTicketsService) {}

  @Get()
  @ApiOperation({ summary: 'The support queue, by view (needs reply first by default)' })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedTicketsEntity })
  async findAll(
    @CurrentUser() actor: AuthUser,
    @Query(new ZodValidationPipe(AdminTicketQuerySchema)) query: AdminTicketQueryDto,
  ): Promise<{ message: string; data: PaginatedTicketsEntity }> {
    return {
      message: 'Tickets retrieved successfully',
      data: await this.tickets.findAll(actor, query),
    };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Counts per view, first-response time and satisfaction' })
  @ApiResponse({ status: HttpStatus.OK, type: TicketSummaryEntity })
  async summary(
    @CurrentUser() actor: AuthUser,
  ): Promise<{ message: string; data: TicketSummaryEntity }> {
    return {
      message: 'Support summary retrieved successfully',
      data: await this.tickets.summary(actor),
    };
  }

  @Get('assignees')
  @ApiOperation({ summary: 'Staff who can be assigned tickets' })
  @ApiResponse({ status: HttpStatus.OK, type: TicketPersonEntity, isArray: true })
  async assignees(): Promise<{ message: string; data: TicketPersonEntity[] }> {
    return { message: 'Assignees retrieved successfully', data: await this.tickets.assignees() };
  }

  @Get(':id')
  @ApiOperation({ summary: 'A ticket with its full thread, notes and customer context' })
  @ApiResponse({ status: HttpStatus.OK, type: TicketDetailEntity })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: TicketDetailEntity }> {
    return { message: 'Ticket retrieved successfully', data: await this.tickets.findOne(id) };
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Reply to the customer, or add an internal note' })
  @ApiBody({ schema: bodySchema(StaffTicketMessageSchema) })
  async reply(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(StaffTicketMessageSchema)) dto: StaffTicketMessageDto,
  ): Promise<{ message: string; data: TicketDetailEntity }> {
    return {
      message: dto.internal ? 'Note added' : 'Reply sent',
      data: await this.tickets.reply(actor, id, dto),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change status, priority, category or assignee' })
  @ApiBody({ schema: bodySchema(UpdateTicketSchema) })
  async update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateTicketSchema)) dto: UpdateTicketDto,
  ): Promise<{ message: string; data: TicketDetailEntity }> {
    return { message: 'Ticket updated', data: await this.tickets.update(actor, id, dto) };
  }
}
