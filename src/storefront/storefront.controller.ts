import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Public } from '../auth/decorators/public.decorator';
import { StorefrontService } from './storefront.service';
import { NavigationEntity } from './entities/navigation.entity';
import { StorefrontCatalogService } from './storefront-catalog.service';
import { CatalogPageEntity, ProductDetailEntity } from './entities/catalog.entity';
import {
  CATALOG_MAX_PAGE_SIZE,
  CATALOG_SORTS,
  CatalogQuerySchema,
  type CatalogQueryDto,
} from './dto/catalog-query.dto';
import { COLLECTION_KEYS } from './storefront.constants';

@ApiTags('Storefront')
@Controller('storefront')
export class StorefrontController {
  constructor(
    private readonly storefrontService: StorefrontService,
    private readonly catalogService: StorefrontCatalogService,
  ) {}

  @Get('navigation')
  @Public()
  @ApiOperation({
    summary: 'Storefront header navigation',
    description:
      'Category tree with live product counts, curated collections, spotlight deal, ' +
      'trending products and the current promotion — cached for 5 minutes.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: NavigationEntity })
  async getNavigation(): Promise<{ message: string; data: NavigationEntity }> {
    const navigation = await this.storefrontService.getNavigation();
    return { message: 'Navigation retrieved successfully', data: navigation };
  }

  @Get('products')
  @Public()
  @ApiOperation({
    summary: 'Shopper catalog listing',
    description:
      'Published products only. Category filter includes sub-categories; price filters and ' +
      'sorting use the price the shopper pays (sale price when set). Returns facet counts.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 24 })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String, example: 'electronics' })
  @ApiQuery({ name: 'collection', required: false, enum: COLLECTION_KEYS })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'inStock', required: false, enum: ['true', 'false'] })
  @ApiQuery({ name: 'sort', required: false, enum: CATALOG_SORTS })
  @ApiResponse({ status: HttpStatus.OK, type: CatalogPageEntity })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: `Validation failed (max limit ${CATALOG_MAX_PAGE_SIZE})`,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Unknown category slug' })
  async listProducts(
    @Query(new ZodValidationPipe(CatalogQuerySchema)) query: CatalogQueryDto,
  ): Promise<{ message: string; data: CatalogPageEntity }> {
    const page = await this.catalogService.listProducts(query);
    return { message: 'Products retrieved successfully', data: page };
  }

  @Get('products/:idOrSlug')
  @Public()
  @ApiOperation({
    summary: 'Shopper product detail',
    description:
      'Published product by numeric id or slug, with variant option matrix, rating ' +
      'summary and related products.',
  })
  @ApiParam({ name: 'idOrSlug', type: String, example: '1' })
  @ApiResponse({ status: HttpStatus.OK, type: ProductDetailEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Missing or unpublished product' })
  async getProduct(
    @Param('idOrSlug') idOrSlug: string,
  ): Promise<{ message: string; data: ProductDetailEntity }> {
    const product = await this.catalogService.getProduct(idOrSlug);
    return { message: 'Product retrieved successfully', data: product };
  }
}
