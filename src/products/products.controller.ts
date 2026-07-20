import {
  Body,
  Controller,
  Delete,
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
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ProductsService } from './products.service';
import { CreateProductSchema, type CreateProductDto } from './dto/create-product.dto';
import { UpdateProductSchema, type UpdateProductDto } from './dto/update-product.dto';
import { ProductQuerySchema, type ProductQueryDto } from './dto/query-product.dto';
import { PaginatedProductsEntity, ProductEntity } from './entities/product.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List products with filtering, sorting, and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'name', 'basePrice', 'stockQuantity'],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'categoryId', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'isPublished', required: false, enum: ['true', 'false'] })
  @ApiQuery({ name: 'inStock', required: false, enum: ['true', 'false'] })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedProductsEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  async findAll(
    @Query(new ZodValidationPipe(ProductQuerySchema)) query: ProductQueryDto,
  ): Promise<{ message: string; data: PaginatedProductsEntity }> {
    const result = await this.productsService.findAll(query);
    return { message: 'Products retrieved successfully', data: result };
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Retrieve a single product with its category and images' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: ProductEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product does not exist' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: ProductEntity }> {
    const product = await this.productsService.findOne(id);
    return { message: 'Product retrieved successfully', data: product };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new product' })
  @ApiBody({ schema: z.toJSONSchema(CreateProductSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: ProductEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Slug or SKU already exists' })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'categoryId references a category that does not exist',
  })
  async create(
    @Body(new ZodValidationPipe(CreateProductSchema)) dto: CreateProductDto,
  ): Promise<{ message: string; data: ProductEntity }> {
    const product = await this.productsService.create(dto);
    return { message: 'Product created successfully', data: product };
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an existing product' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: z.toJSONSchema(UpdateProductSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: ProductEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product does not exist' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Slug or SKU already exists' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateProductSchema)) dto: UpdateProductDto,
  ): Promise<{ message: string; data: ProductEntity }> {
    const product = await this.productsService.update(id, dto);
    return { message: 'Product updated successfully', data: product };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a product' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product does not exist' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string; data: null }> {
    await this.productsService.remove(id);
    return { message: 'Product deleted successfully', data: null };
  }
}
