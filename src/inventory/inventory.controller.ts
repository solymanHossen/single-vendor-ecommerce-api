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
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { GLOBAL_THROTTLE_KEY } from '../common/constants/throttler.constants';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { InventoryService } from './inventory.service';
import {
  AdjustStockSchema,
  ImportStockSchema,
  InventoryQuerySchema,
  MovementQuerySchema,
  StockAlertSchema,
  type AdjustStockDto,
  type ImportStockDto,
  type InventoryQueryDto,
  type MovementQueryDto,
  type StockAlertDto,
} from './dto/inventory.dto';
import {
  ImportResultEntity,
  InventoryPageEntity,
  InventoryUnitEntity,
  StockMovementPageEntity,
} from './entities/inventory.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];
const bodySchema = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as unknown as ApiBodySchema;

@ApiTags('Inventory (admin)')
@ApiBearerAuth()
@RequirePermissions('catalog.manage')
@Controller('admin/inventory')
export class AdminInventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @ApiOperation({
    summary: 'Every stock unit with level, 30-day sales, days of cover and reorder suggestion',
  })
  @ApiResponse({ status: HttpStatus.OK, type: InventoryPageEntity })
  async list(
    @Query(new ZodValidationPipe(InventoryQuerySchema)) query: InventoryQueryDto,
  ): Promise<{ message: string; data: InventoryPageEntity }> {
    return { message: 'Inventory retrieved successfully', data: await this.inventory.list(query) };
  }

  @Post('adjustments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record received, damaged, lost, a correction or a recount' })
  @ApiBody({ schema: bodySchema(AdjustStockSchema) })
  @ApiResponse({ status: HttpStatus.CREATED, type: InventoryUnitEntity })
  async adjust(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(AdjustStockSchema)) dto: AdjustStockDto,
  ): Promise<{ message: string; data: InventoryUnitEntity }> {
    return { message: 'Stock updated', data: await this.inventory.adjust(dto, actor.id) };
  }

  @Get('movements')
  @ApiOperation({ summary: 'The stock ledger: every change, newest first' })
  @ApiResponse({ status: HttpStatus.OK, type: StockMovementPageEntity })
  async movements(
    @Query(new ZodValidationPipe(MovementQuerySchema)) query: MovementQueryDto,
  ): Promise<{ message: string; data: StockMovementPageEntity }> {
    return {
      message: 'Stock history retrieved successfully',
      data: await this.inventory.movements(query),
    };
  }

  @Get('export')
  @ApiOperation({ summary: 'Download every stock unit as CSV' })
  async export(@Res() res: Response): Promise<void> {
    const csv = await this.inventory.exportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="inventory-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(csv);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set counts from CSV (sku, on_hand) — preview with dryRun, then apply' })
  @ApiBody({ schema: bodySchema(ImportStockSchema) })
  @ApiResponse({ status: HttpStatus.OK, type: ImportResultEntity })
  async import(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(ImportStockSchema)) dto: ImportStockDto,
  ): Promise<{ message: string; data: ImportResultEntity }> {
    const result = await this.inventory.importCsv(dto, actor.id);
    return { message: result.applied ? 'Stock imported' : 'Import preview', data: result };
  }
}

@ApiTags('Storefront')
@Controller('storefront/products')
export class StockAlertsController {
  constructor(private readonly inventory: InventoryService) {}

  @Post(':id/stock-alerts')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ [GLOBAL_THROTTLE_KEY]: { limit: 10, ttl: 10 * 60_000 } })
  @ApiOperation({ summary: 'Email me when this (sold-out) item is back' })
  @ApiBody({ schema: bodySchema(StockAlertSchema) })
  async subscribe(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(StockAlertSchema)) dto: StockAlertDto,
  ): Promise<{ message: string; data: { subscribed: true } }> {
    return {
      message: 'We’ll email you when it’s back',
      data: await this.inventory.subscribe(id, dto, null),
    };
  }
}
