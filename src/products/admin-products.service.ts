import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { LOW_STOCK_THRESHOLD } from './products.constants';
import type { AdminProductQueryDto, AdminProductSortField } from './dto/admin-product-query.dto';
import type { BulkProductStatusDto } from './dto/bulk-product-status.dto';
import { PaginationMetaEntity } from './entities/product.entity';
import {
  AdminProductCategoryEntity,
  AdminProductRowEntity,
  AdminProductSummaryEntity,
  BulkProductStatusResultEntity,
  PaginatedAdminProductsEntity,
} from './entities/admin-product.entity';

const ADMIN_PRODUCT_ROW_SELECT = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  basePrice: true,
  discountPrice: true,
  stockQuantity: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  images: {
    select: { url: true },
    orderBy: [{ isThumbnail: 'desc' }, { id: 'asc' }],
    take: 1,
  },
  _count: { select: { variants: true, orderItems: true } },
} satisfies Prisma.ProductSelect;

type AdminProductRow = Prisma.ProductGetPayload<{ select: typeof ADMIN_PRODUCT_ROW_SELECT }>;

const STOCK_FILTERS = {
  in: { gt: LOW_STOCK_THRESHOLD },
  low: { gt: 0, lte: LOW_STOCK_THRESHOLD },
  out: { equals: 0 },
} satisfies Record<string, Prisma.IntFilter<'Product'>>;

@Injectable()
export class AdminProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminProductQueryDto): Promise<PaginatedAdminProductsEntity> {
    const scope = this.buildScope(query);
    const where: Prisma.ProductWhereInput = { ...scope };
    if (query.status !== 'all') where.isPublished = query.status === 'published';
    if (query.stock !== 'all') where.stockQuantity = STOCK_FILTERS[query.stock];

    // One round trip: the page, its total and every tab count.
    const [rows, total, all, published, lowStock, outOfStock] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: ADMIN_PRODUCT_ROW_SELECT,
        orderBy: this.buildOrderBy(query.sortBy, query.sortOrder),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
      this.prisma.product.count({ where: scope }),
      this.prisma.product.count({ where: { ...scope, isPublished: true } }),
      this.prisma.product.count({ where: { ...scope, stockQuantity: STOCK_FILTERS.low } }),
      this.prisma.product.count({ where: { ...scope, stockQuantity: STOCK_FILTERS.out } }),
    ]);

    return new PaginatedAdminProductsEntity({
      items: rows.map((row) => this.toRow(row)),
      meta: new PaginationMetaEntity({
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      }),
      summary: new AdminProductSummaryEntity({
        total: all,
        published,
        draft: all - published,
        lowStock,
        outOfStock,
        lowStockThreshold: LOW_STOCK_THRESHOLD,
      }),
    });
  }

  async setPublished(dto: BulkProductStatusDto): Promise<BulkProductStatusResultEntity> {
    const result = await this.prisma.product.updateMany({
      where: { id: { in: dto.ids } },
      data: { isPublished: dto.isPublished },
    });
    return new BulkProductStatusResultEntity({ updated: result.count });
  }

  /** Search + category: the filters the tab counts honour. */
  private buildScope(query: AdminProductQueryDto): Prisma.ProductWhereInput {
    const scope: Prisma.ProductWhereInput = {};
    if (query.categoryId !== undefined) scope.categoryId = query.categoryId;
    if (query.search !== undefined) {
      scope.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { variants: { some: { sku: { contains: query.search, mode: 'insensitive' } } } },
      ];
    }
    return scope;
  }

  private buildOrderBy(
    sortBy: AdminProductSortField,
    sortOrder: 'asc' | 'desc',
  ): Prisma.ProductOrderByWithRelationInput[] {
    // id breaks ties so paging never repeats or skips a row.
    return [{ [sortBy]: sortOrder }, { id: sortOrder }];
  }

  private toRow(row: AdminProductRow): AdminProductRowEntity {
    return new AdminProductRowEntity({
      id: row.id,
      name: row.name,
      slug: row.slug,
      sku: row.sku,
      basePrice: row.basePrice,
      discountPrice: row.discountPrice,
      stockQuantity: row.stockQuantity,
      isPublished: row.isPublished,
      thumbnailUrl: row.images[0]?.url ?? null,
      category: new AdminProductCategoryEntity(row.category),
      variantCount: row._count.variants,
      orderCount: row._count.orderItems,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
