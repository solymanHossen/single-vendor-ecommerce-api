import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { CatalogQuerySchema, type CatalogQueryDto } from '../storefront/dto/catalog-query.dto';
import { CatalogPageEntity } from '../storefront/entities/catalog.entity';
import { CampaignsService } from './campaigns.service';
import {
  AdminCampaignQuerySchema,
  CreateCampaignSchema,
  UpdateCampaignSchema,
  type AdminCampaignQueryDto,
  type CreateCampaignDto,
  type UpdateCampaignDto,
} from './dto/campaign.dto';
import {
  CampaignDetailEntity,
  FeaturedCampaignEntity,
  PaginatedCampaignsEntity,
  PublicCampaignEntity,
} from './entities/campaign.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];
const bodySchema = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as unknown as ApiBodySchema;

/** Shopper-facing: landing pages and the homepage feature. */
@ApiTags('Campaigns')
@Controller('storefront/campaigns')
export class StorefrontCampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get('featured')
  @Public()
  @ApiOperation({ summary: 'The featured live campaign with a few of its products (or null)' })
  @ApiResponse({ status: HttpStatus.OK, type: FeaturedCampaignEntity })
  async featured(): Promise<{ message: string; data: FeaturedCampaignEntity | null }> {
    return {
      message: 'Featured campaign retrieved successfully',
      data: await this.campaigns.featured(),
    };
  }

  @Get(':slug')
  @Public()
  @ApiOperation({ summary: 'A published campaign (scheduled, live or ended)' })
  @ApiResponse({ status: HttpStatus.OK, type: PublicCampaignEntity })
  async findOne(
    @Param('slug') slug: string,
  ): Promise<{ message: string; data: PublicCampaignEntity }> {
    return {
      message: 'Campaign retrieved successfully',
      data: await this.campaigns.findPublic(slug),
    };
  }

  @Get(':slug/products')
  @Public()
  @ApiOperation({ summary: 'A campaign’s products with live prices (catalog sort and filters)' })
  @ApiResponse({ status: HttpStatus.OK, type: CatalogPageEntity })
  async products(
    @Param('slug') slug: string,
    @Query(new ZodValidationPipe(CatalogQuerySchema)) query: CatalogQueryDto,
  ): Promise<{ message: string; data: CatalogPageEntity }> {
    return {
      message: 'Campaign products retrieved successfully',
      data: await this.campaigns.products(slug, query),
    };
  }
}

@ApiTags('Campaigns (admin)')
@ApiBearerAuth()
@RequirePermissions('campaigns.manage')
@Controller('admin/campaigns')
export class AdminCampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  @ApiOperation({ summary: 'Campaigns by status, with sales and counts per status' })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedCampaignsEntity })
  async findAll(
    @Query(new ZodValidationPipe(AdminCampaignQuerySchema)) query: AdminCampaignQueryDto,
  ): Promise<{ message: string; data: PaginatedCampaignsEntity }> {
    return {
      message: 'Campaigns retrieved successfully',
      data: await this.campaigns.findAll(query),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'A campaign with its products, categories and sales' })
  @ApiResponse({ status: HttpStatus.OK, type: CampaignDetailEntity })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: CampaignDetailEntity }> {
    return { message: 'Campaign retrieved successfully', data: await this.campaigns.findOne(id) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a campaign (a draft unless isActive)' })
  @ApiBody({ schema: bodySchema(CreateCampaignSchema) })
  async create(
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
    @Body(new ZodValidationPipe(CreateCampaignSchema)) dto: CreateCampaignDto,
  ): Promise<{ message: string; data: CampaignDetailEntity }> {
    return { message: 'Campaign created', data: await this.campaigns.create(dto, { actor, ip }) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a campaign (productIds / categoryIds replace the lists)' })
  @ApiBody({ schema: bodySchema(UpdateCampaignSchema) })
  async update(
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateCampaignSchema)) dto: UpdateCampaignDto,
  ): Promise<{ message: string; data: CampaignDetailEntity }> {
    return {
      message: 'Campaign updated',
      data: await this.campaigns.update(id, dto, { actor, ip }),
    };
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End a scheduled or live campaign now' })
  async end(
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: CampaignDetailEntity }> {
    return { message: 'Campaign ended', data: await this.campaigns.endNow(id, { actor, ip }) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a campaign that never sold anything' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'It has sold items — end it instead' })
  async remove(
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: null }> {
    await this.campaigns.remove(id, { actor, ip });
    return { message: 'Campaign deleted', data: null };
  }
}
