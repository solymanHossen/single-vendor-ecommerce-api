import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto, ProductSortField } from './dto/query-product.dto';
import { CategorySummaryEntity } from '../categories/entities/category.entity';
import {
  ProductVariantSummaryEntity,
  VariantAttributeOptionEntity,
} from '../product-variants/entities/product-variant.entity';
import {
  PaginatedProductsEntity,
  PaginationMetaEntity,
  ProductEntity,
  ProductImageEntity,
} from './entities/product.entity';

const PRODUCT_SELECT = {
  id: true,
  categoryId: true,
  name: true,
  slug: true,
  description: true,
  basePrice: true,
  discountPrice: true,
  sku: true,
  stockQuantity: true,
  isPublished: true,
  metaTitle: true,
  metaDesc: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true, iconUrl: true } },
  images: { select: { id: true, url: true, isThumbnail: true }, orderBy: { isThumbnail: 'desc' } },
  variants: {
    select: {
      id: true,
      sku: true,
      price: true,
      stockQuantity: true,
      imageUrl: true,
      options: {
        select: {
          attributeOption: {
            select: {
              id: true,
              value: true,
              attributeId: true,
              attribute: { select: { name: true } },
            },
          },
        },
        orderBy: { id: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_SELECT }>;

export interface PaginatedProductsResult {
  items: ProductEntity[];
  meta: PaginationMetaEntity;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ProductQueryDto): Promise<PaginatedProductsEntity> {
    const where = this.buildWhere(query);
    const orderBy = this.buildOrderBy(query.sortBy, query.sortOrder);

    // Batched via $transaction rather than two sequential calls: one round
    // trip to Postgres for both the page of rows and the matching total count.
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: PRODUCT_SELECT,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return new PaginatedProductsEntity({
      items: rows.map((row) => this.toEntity(row)),
      meta: new PaginationMetaEntity({
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      }),
    });
  }

  /**
   * `publishedOnly` is set by the public route so a draft 404s for shoppers
   * exactly like a product that doesn't exist; the admin route omits it.
   */
  async findOne(id: number, options: { publishedOnly?: boolean } = {}): Promise<ProductEntity> {
    const product = await this.prisma.product.findFirstOrThrow({
      where: options.publishedOnly ? { id, isPublished: true } : { id },
      select: PRODUCT_SELECT,
    });

    return this.toEntity(product);
  }

  async create(dto: CreateProductDto): Promise<ProductEntity> {
    const { images, ...scalarData } = dto;

    const product = await this.prisma.product.create({
      data:
        images && images.length > 0 ? { ...scalarData, images: { create: images } } : scalarData,
      select: PRODUCT_SELECT,
    });

    return this.toEntity(product);
  }

  async update(id: number, dto: UpdateProductDto): Promise<ProductEntity> {
    const { images, ...scalarData } = dto;

    // A product with variants derives its stock from them (kept in sync by
    // ProductVariantsService), so a direct write would be overwritten on the
    // next variant change — refuse it instead of silently losing the value.
    if (scalarData.stockQuantity !== undefined) {
      const variantCount = await this.prisma.productVariant.count({ where: { productId: id } });
      if (variantCount > 0) {
        throw new BadRequestException(
          'Stock is managed per variant for this product — update the variants instead',
        );
      }
    }

    const product = await this.prisma.product.update({
      where: { id },
      // Nested write executed as a single Prisma call: replaces the
      // product's entire image set atomically rather than looping
      // create/delete calls from application code.
      data:
        images !== undefined
          ? { ...scalarData, images: { deleteMany: {}, create: images } }
          : scalarData,
      select: PRODUCT_SELECT,
    });

    return this.toEntity(product);
  }

  async remove(id: number): Promise<void> {
    // OrderItem.productId is a RESTRICT foreign key (order history must keep
    // pointing at a real product). Checking first turns what would be a
    // generic FK failure into an actionable message.
    const orderLines = await this.prisma.orderItem.count({ where: { productId: id } });
    if (orderLines > 0) {
      throw new ConflictException(
        `This product appears in ${orderLines} order ${orderLines === 1 ? 'line' : 'lines'} and can't be deleted. Unpublish it instead.`,
      );
    }

    // ProductImage.productId cascades on delete at the database level, so
    // removing a product cleans up its images without a manual loop.
    await this.prisma.product.delete({ where: { id } });
  }

  private buildWhere(query: ProductQueryDto): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {};

    if (query.categoryId !== undefined) {
      where.categoryId = query.categoryId;
    }

    if (query.isPublished !== undefined) {
      where.isPublished = query.isPublished;
    }

    if (query.inStock !== undefined) {
      where.stockQuantity = query.inStock ? { gt: 0 } : { equals: 0 };
    }

    if (query.search !== undefined) {
      // Category name is included so shoppers typing a department ("audio",
      // "skincare") find its products, not only exact product-name matches.
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { category: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const priceFilter: Prisma.DecimalFilter<'Product'> = {};
      if (query.minPrice !== undefined) {
        priceFilter.gte = query.minPrice;
      }
      if (query.maxPrice !== undefined) {
        priceFilter.lte = query.maxPrice;
      }
      where.basePrice = priceFilter;
    }

    return where;
  }

  private buildOrderBy(
    sortBy: ProductSortField,
    sortOrder: 'asc' | 'desc',
  ): Prisma.ProductOrderByWithRelationInput {
    switch (sortBy) {
      case 'name':
        return { name: sortOrder };
      case 'basePrice':
        return { basePrice: sortOrder };
      case 'stockQuantity':
        return { stockQuantity: sortOrder };
      case 'createdAt':
        return { createdAt: sortOrder };
    }
  }

  private toEntity(product: ProductRow): ProductEntity {
    return new ProductEntity({
      id: product.id,
      categoryId: product.categoryId,
      category: new CategorySummaryEntity(product.category),
      name: product.name,
      slug: product.slug,
      description: product.description,
      basePrice: product.basePrice,
      discountPrice: product.discountPrice,
      sku: product.sku,
      stockQuantity: product.stockQuantity,
      isPublished: product.isPublished,
      metaTitle: product.metaTitle,
      metaDesc: product.metaDesc,
      images: product.images.map((image) => new ProductImageEntity(image)),
      variants: product.variants.map(
        (variant) =>
          new ProductVariantSummaryEntity({
            id: variant.id,
            sku: variant.sku,
            price: variant.price,
            stockQuantity: variant.stockQuantity,
            imageUrl: variant.imageUrl,
            options: variant.options.map(
              (option) =>
                new VariantAttributeOptionEntity({
                  attributeOptionId: option.attributeOption.id,
                  attributeId: option.attributeOption.attributeId,
                  attributeName: option.attributeOption.attribute.name,
                  value: option.attributeOption.value,
                }),
            ),
          }),
      ),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    });
  }
}
