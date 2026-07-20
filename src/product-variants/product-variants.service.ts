import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import {
  ProductVariantEntity,
  VariantAttributeOptionEntity,
} from './entities/product-variant.entity';

const PRODUCT_VARIANT_SELECT = {
  id: true,
  productId: true,
  sku: true,
  price: true,
  stockQuantity: true,
  imageUrl: true,
  createdAt: true,
  updatedAt: true,
  options: {
    select: {
      attributeOption: {
        select: { id: true, value: true, attributeId: true, attribute: { select: { name: true } } },
      },
    },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.ProductVariantSelect;

type ProductVariantRow = Prisma.ProductVariantGetPayload<{
  select: typeof PRODUCT_VARIANT_SELECT;
}>;

@Injectable()
export class ProductVariantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByProduct(productId: number): Promise<ProductVariantEntity[]> {
    // Confirms the parent product exists before listing — a bare `findMany`
    // would otherwise return an empty array for a non-existent product,
    // indistinguishable from "product exists but has no variants".
    await this.prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { id: true } });

    const rows = await this.prisma.productVariant.findMany({
      where: { productId },
      select: PRODUCT_VARIANT_SELECT,
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => this.toEntity(row));
  }

  async findOne(id: number): Promise<ProductVariantEntity> {
    const variant = await this.prisma.productVariant.findUniqueOrThrow({
      where: { id },
      select: PRODUCT_VARIANT_SELECT,
    });

    return this.toEntity(variant);
  }

  async create(productId: number, dto: CreateProductVariantDto): Promise<ProductVariantEntity> {
    const { attributeOptionIds, ...scalarData } = dto;

    // productId and each attributeOptionId are plain scalar/nested-create
    // assignments, so a reference to a product or attribute option that
    // doesn't exist fails the FK constraint at the database level (P2003 →
    // 422) rather than needing manual existence checks here.
    const variant = await this.prisma.productVariant.create({
      data: {
        ...scalarData,
        productId,
        options: { create: attributeOptionIds.map((attributeOptionId) => ({ attributeOptionId })) },
      },
      select: PRODUCT_VARIANT_SELECT,
    });

    return this.toEntity(variant);
  }

  async update(id: number, dto: UpdateProductVariantDto): Promise<ProductVariantEntity> {
    const { attributeOptionIds, ...scalarData } = dto;

    // Safe to fully replace the option set (deleteMany + create) here, unlike
    // AttributeOption: nothing else references a VariantOption row, so
    // regenerating its ids on update has no downstream impact.
    const variant = await this.prisma.productVariant.update({
      where: { id },
      data:
        attributeOptionIds !== undefined
          ? {
              ...scalarData,
              options: {
                deleteMany: {},
                create: attributeOptionIds.map((attributeOptionId) => ({ attributeOptionId })),
              },
            }
          : scalarData,
      select: PRODUCT_VARIANT_SELECT,
    });

    return this.toEntity(variant);
  }

  async remove(id: number): Promise<void> {
    // VariantOption.variantId cascades on delete, so removing a variant
    // cleans up its option links without a manual loop.
    await this.prisma.productVariant.delete({ where: { id } });
  }

  private toEntity(variant: ProductVariantRow): ProductVariantEntity {
    return new ProductVariantEntity({
      id: variant.id,
      productId: variant.productId,
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
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    });
  }
}
