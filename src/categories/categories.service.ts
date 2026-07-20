import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import {
  CategoryEntity,
  CategorySummaryEntity,
  CategoryTreeNodeEntity,
} from './entities/category.entity';

const CATEGORY_SUMMARY_SELECT = {
  id: true,
  name: true,
  slug: true,
  iconUrl: true,
} satisfies Prisma.CategorySelect;

const CATEGORY_TREE_SELECT = {
  id: true,
  name: true,
  slug: true,
  iconUrl: true,
  parentId: true,
} satisfies Prisma.CategorySelect;

const CATEGORY_DETAIL_SELECT = {
  id: true,
  name: true,
  slug: true,
  parentId: true,
  iconUrl: true,
  metaTitle: true,
  metaDesc: true,
  createdAt: true,
  updatedAt: true,
  parent: { select: CATEGORY_SUMMARY_SELECT },
  children: { select: CATEGORY_SUMMARY_SELECT, orderBy: { name: 'asc' } },
  _count: { select: { products: true } },
} satisfies Prisma.CategorySelect;

type CategoryTreeRow = Prisma.CategoryGetPayload<{ select: typeof CATEGORY_TREE_SELECT }>;
type CategoryDetailRow = Prisma.CategoryGetPayload<{ select: typeof CATEGORY_DETAIL_SELECT }>;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the full category hierarchy as a nested tree, built from a single
   * flat query. Prisma has no native recursive-include, and fetching each
   * level with a separate query would be an N+1 (depth-many round trips) —
   * one `findMany` plus an in-memory O(n) grouping avoids both.
   */
  async findTree(): Promise<CategoryTreeNodeEntity[]> {
    const rows = await this.prisma.category.findMany({
      select: CATEGORY_TREE_SELECT,
      orderBy: { name: 'asc' },
    });

    return this.buildTree(rows);
  }

  async findOne(id: number): Promise<CategoryEntity> {
    const category = await this.prisma.category.findUniqueOrThrow({
      where: { id },
      select: CATEGORY_DETAIL_SELECT,
    });

    return this.toEntity(category);
  }

  async create(dto: CreateCategoryDto): Promise<CategoryEntity> {
    const created = await this.prisma.category.create({
      data: dto,
      select: { id: true },
    });

    return this.findOne(created.id);
  }

  async update(id: number, dto: UpdateCategoryDto): Promise<CategoryEntity> {
    await this.prisma.category.update({
      where: { id },
      data: dto,
      select: { id: true },
    });

    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    // Product.categoryId and Category.parentId are FK-constrained: deleting a
    // category that still has products or child categories fails at the
    // database level and is translated to a 422 by PrismaClientExceptionFilter
    // — no manual "is this category in use?" guard needed here.
    await this.prisma.category.delete({ where: { id } });
  }

  private buildTree(rows: CategoryTreeRow[]): CategoryTreeNodeEntity[] {
    const childrenByParent = new Map<number | null, CategoryTreeRow[]>();

    for (const row of rows) {
      const bucket = childrenByParent.get(row.parentId);
      if (bucket) {
        bucket.push(row);
      } else {
        childrenByParent.set(row.parentId, [row]);
      }
    }

    const attach = (parentId: number | null): CategoryTreeNodeEntity[] =>
      (childrenByParent.get(parentId) ?? []).map(
        (row) =>
          new CategoryTreeNodeEntity({
            id: row.id,
            name: row.name,
            slug: row.slug,
            iconUrl: row.iconUrl,
            children: attach(row.id),
          }),
      );

    return attach(null);
  }

  private toEntity(category: CategoryDetailRow): CategoryEntity {
    return new CategoryEntity({
      id: category.id,
      name: category.name,
      slug: category.slug,
      parentId: category.parentId,
      iconUrl: category.iconUrl,
      metaTitle: category.metaTitle,
      metaDesc: category.metaDesc,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      productCount: category._count.products,
      parent: category.parent ? new CategorySummaryEntity(category.parent) : null,
      children: category.children.map((child) => new CategorySummaryEntity(child)),
    });
  }
}
