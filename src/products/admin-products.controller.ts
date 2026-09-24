import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
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
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AdminProductsService } from './admin-products.service';
import { ProductsService } from './products.service';
import {
  ADMIN_PRODUCT_SORT_FIELDS,
  AdminProductQuerySchema,
  type AdminProductQueryDto,
} from './dto/admin-product-query.dto';
import { BulkProductStatusSchema, type BulkProductStatusDto } from './dto/bulk-product-status.dto';
import {
  BulkProductStatusResultEntity,
  PaginatedAdminProductsEntity,
} from './entities/admin-product.entity';
import { ProductEntity } from './entities/product.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

/**
 * Catalogue management reads. Writes (create/update/delete) stay on
 * /products, already gated to the same roles.
 */
@ApiTags('Admin · Products')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin/products')
export class AdminProductsController {
  constructor(
    private readonly adminProductsService: AdminProductsService,
    private readonly productsService: ProductsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List every product, drafts included, with status tab counts' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'categoryId', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['all', 'published', 'draft'] })
  @ApiQuery({ name: 'stock', required: false, enum: ['all', 'in', 'low', 'out'] })
  @ApiQuery({ name: 'sortBy', required: false, enum: ADMIN_PRODUCT_SORT_FIELDS })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedAdminProductsEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  async findAll(
    @Query(new ZodValidationPipe(AdminProductQuerySchema)) query: AdminProductQueryDto,
  ): Promise<{ message: string; data: PaginatedAdminProductsEntity }> {
    const data = await this.adminProductsService.findAll(query);
    return { message: 'Products retrieved successfully', data };
  }

  @Patch('status')
  @ApiOperation({ summary: 'Publish or unpublish several products at once' })
  @ApiBody({ schema: z.toJSONSchema(BulkProductStatusSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: BulkProductStatusResultEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  async setStatus(
    @Body(new ZodValidationPipe(BulkProductStatusSchema)) dto: BulkProductStatusDto,
  ): Promise<{ message: string; data: BulkProductStatusResultEntity }> {
    const data = await this.adminProductsService.setPublished(dto);
    return {
      message: `${data.updated} ${data.updated === 1 ? 'product' : 'products'} ${dto.isPublished ? 'published' : 'unpublished'}`,
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve any product, drafts included, for editing' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: ProductEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product does not exist' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: ProductEntity }> {
    const data = await this.productsService.findOne(id);
    return { message: 'Product retrieved successfully', data };
  }
}
