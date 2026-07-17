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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AUTH_THROTTLE_KEY, CHECKOUT_THROTTLE_KEY } from '../common/constants/throttler.constants';
import { PaymentsService } from './payments.service';
import { CreatePaymentSchema, type CreatePaymentDto } from './dto/create-payment.dto';
import {
  UpdatePaymentStatusSchema,
  type UpdatePaymentStatusDto,
} from './dto/update-payment-status.dto';
import { PaymentEntity } from './entities/payment.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

@ApiTags('Payments')
@ApiBearerAuth()
// Every registered throttler tier applies to every route by default unless
// explicitly skipped (see HealthController for the same gotcha, verified
// live there) — none of these endpoints are login-like, so the "auth" tier's
// far stricter 10-req/15-min default must not silently bind ahead of the
// "checkout" tier's own (looser) limit below.
@SkipThrottle({ [AUTH_THROTTLE_KEY]: true })
@Throttle({ [CHECKOUT_THROTTLE_KEY]: { limit: 20, ttl: 60_000 } })
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Record a new payment for an order' })
  @ApiBody({ schema: z.toJSONSchema(CreatePaymentSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: PaymentEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Order already has a payment' })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'orderId references an order that does not exist',
  })
  async create(
    @Body(new ZodValidationPipe(CreatePaymentSchema)) dto: CreatePaymentDto,
  ): Promise<{ message: string; data: PaymentEntity }> {
    const payment = await this.paymentsService.create(dto);
    return { message: 'Payment recorded successfully', data: payment };
  }

  @Get(':id')
  @ApiOperation({ summary: "Retrieve a payment (its order's owner, or ADMIN/SUPER_ADMIN)" })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: PaymentEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Payment does not exist' })
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: PaymentEntity }> {
    const payment = await this.paymentsService.findOne(user, id);
    return { message: 'Payment retrieved successfully', data: payment };
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: "Update a payment's status, keeping the parent order's paymentStatus in sync",
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: z.toJSONSchema(UpdatePaymentStatusSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: PaymentEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Payment does not exist' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdatePaymentStatusSchema)) dto: UpdatePaymentStatusDto,
  ): Promise<{ message: string; data: PaymentEntity }> {
    const payment = await this.paymentsService.updateStatus(id, dto);
    return { message: 'Payment status updated successfully', data: payment };
  }
}
