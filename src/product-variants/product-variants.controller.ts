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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ProductVariantsService } from './product-variants.service';
import {
  CreateProductVariantSchema,
  type CreateProductVariantDto,
} from './dto/create-product-variant.dto';
import {
  UpdateProductVariantSchema,
  type UpdateProductVariantDto,
} from './dto/update-product-variant.dto';
import { ProductVariantEntity } from './entities/product-variant.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

@ApiTags('Product Variants')
@Controller()
export class ProductVariantsController {
  constructor(private readonly productVariantsService: ProductVariantsService) {}

  @Get('products/:productId/variants')
  @Public()
  @ApiOperation({ summary: 'List all variants for a product' })
  @ApiParam({ name: 'productId', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: ProductVariantEntity, isArray: true })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product does not exist' })
  async findAllByProduct(
    @Param('productId', ParseIntPipe) productId: number,
  ): Promise<{ message: string; data: ProductVariantEntity[] }> {
    const variants = await this.productVariantsService.findAllByProduct(productId);
    return { message: 'Product variants retrieved successfully', data: variants };
  }

  @Post('products/:productId/variants')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new variant for a product' })
  @ApiParam({ name: 'productId', type: Number })
  @ApiBody({ schema: z.toJSONSchema(CreateProductVariantSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: ProductVariantEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'sku already exists' })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'productId or an attributeOptionId references a record that does not exist',
  })
  async create(
    @Param('productId', ParseIntPipe) productId: number,
    @Body(new ZodValidationPipe(CreateProductVariantSchema)) dto: CreateProductVariantDto,
  ): Promise<{ message: string; data: ProductVariantEntity }> {
    const variant = await this.productVariantsService.create(productId, dto);
    return { message: 'Product variant created successfully', data: variant };
  }

  @Get('product-variants/:id')
  @Public()
  @ApiOperation({ summary: 'Retrieve a single product variant with its attribute options' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: ProductVariantEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product variant does not exist' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: ProductVariantEntity }> {
    const variant = await this.productVariantsService.findOne(id);
    return { message: 'Product variant retrieved successfully', data: variant };
  }

  @Patch('product-variants/:id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an existing product variant' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: z.toJSONSchema(UpdateProductVariantSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: ProductVariantEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product variant does not exist' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'sku already exists' })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'An attributeOptionId references a record that does not exist',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateProductVariantSchema)) dto: UpdateProductVariantDto,
  ): Promise<{ message: string; data: ProductVariantEntity }> {
    const variant = await this.productVariantsService.update(id, dto);
    return { message: 'Product variant updated successfully', data: variant };
  }

  @Delete('product-variants/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a product variant' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product variant deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product variant does not exist' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string; data: null }> {
    await this.productVariantsService.remove(id);
    return { message: 'Product variant deleted successfully', data: null };
  }
}
