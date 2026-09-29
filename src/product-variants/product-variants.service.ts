import { Injectable } from '@nestjs/common';
import { StockMovementType, type Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { StockLedgerService } from '../inventory/stock-ledger.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedgerService,
  ) {}

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

  async create(
    productId: number,
    dto: CreateProductVariantDto,
    actorId?: number,
  ): Promise<ProductVariantEntity> {
    const { attributeOptionIds, stockQuantity, ...scalarData } = dto;

    // productId and each attributeOptionId are plain scalar/nested-create
    // assignments, so a reference to a product or attribute option that
    // doesn't exist fails the FK constraint at the database level (P2003 →
    // 422) rather than needing manual existence checks here.
    const variant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.productVariant.create({
        data: {
          ...scalarData,
          productId,
          options: {
            create: attributeOptionIds.map((attributeOptionId) => ({ attributeOptionId })),
          },
        },
        select: { id: true },
      });
      // Created at 0, then stocked through the ledger so the opening count is on record.
      if (stockQuantity > 0) {
        await this.ledger.apply(tx, [
          {
            productId,
            variantId: created.id,
            delta: stockQuantity,
            type: StockMovementType.INITIAL,
            actorId,
          },
        ]);
      } else {
        await this.syncProductStock(tx, productId);
      }
      return tx.productVariant.findUniqueOrThrow({
        where: { id: created.id },
        select: PRODUCT_VARIANT_SELECT,
      });
    });

    return this.toEntity(variant);
  }

  async update(
    id: number,
    dto: UpdateProductVariantDto,
    actorId?: number,
  ): Promise<ProductVariantEntity> {
    const { attributeOptionIds, stockQuantity, ...scalarData } = dto;

    // Safe to fully replace the option set (deleteMany + create) here, unlike
    // AttributeOption: nothing else references a VariantOption row, so
    // regenerating its ids on update has no downstream impact.
    const variant = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.productVariant.update({
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
        select: { id: true, productId: true },
      });
      // A typed count is a recount — row-locked and on record.
      if (stockQuantity !== undefined) {
        await this.ledger.set(tx, { productId: updated.productId, variantId: id }, stockQuantity, {
          type: StockMovementType.RECOUNT,
          actorId,
          note: 'Set on the product page',
        });
      }
      return tx.productVariant.findUniqueOrThrow({ where: { id }, select: PRODUCT_VARIANT_SELECT });
    });

    return this.toEntity(variant);
  }

  async remove(id: number): Promise<void> {
    // VariantOption.variantId cascades on delete, so removing a variant
    // cleans up its option links without a manual loop.
    await this.prisma.$transaction(async (tx) => {
      const { productId } = await tx.productVariant.delete({
        where: { id },
        select: { productId: true },
      });
      await this.syncProductStock(tx, productId);
    });
  }

  /**
   * A product with variants sells only through them, so its own stock is
   * the sum of theirs. Recomputed inside the same transaction as the write
   * so the catalogue, stock filters and dashboard never disagree.
   */
  private async syncProductStock(tx: Prisma.TransactionClient, productId: number): Promise<void> {
    const { _sum } = await tx.productVariant.aggregate({
      where: { productId },
      _sum: { stockQuantity: true },
    });
    await tx.product.update({
      where: { id: productId },
      data: { stockQuantity: _sum.stockQuantity ?? 0 },
      select: { id: true },
    });
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
