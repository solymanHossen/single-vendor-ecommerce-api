import { PrismaClient, type Prisma } from '@prisma/client';
import type { Seeder } from './seeder.interface';
import { insertAll, resetIdentitySequence, truncateTable, daysAgo } from './seeder.utils';
import { CATEGORY_TREE } from './data/catalog.data';
import { IMG, unsplashUrl } from './data/images.data';

export class CategorySeeder implements Seeder {
  readonly name = 'CategorySeeder';
  readonly description = 'Seeds the two-level storefront category tree';
  readonly order = 5;

  async seed(prisma: PrismaClient): Promise<void> {
    console.info('🧹 Cleaning "categories" table (cascades to products)...');
    await truncateTable(prisma, 'categories');

    const createdAt = daysAgo(365);
    const parents: Prisma.CategoryCreateManyInput[] = [];
    const children: Prisma.CategoryCreateManyInput[] = [];
    let nextId = 1;

    for (const parent of CATEGORY_TREE) {
      const parentId = nextId++;
      parents.push(this.toRow(parentId, null, parent, createdAt));

      for (const child of parent.children ?? []) {
        children.push(this.toRow(nextId++, parentId, child, createdAt));
      }
    }

    // Parents are inserted first so every child's parent_id FK already resolves.
    await insertAll(prisma.category, parents, 'categories (parents)');
    await insertAll(prisma.category, children, 'categories (children)');
    await resetIdentitySequence(prisma, 'categories');

    console.info(`✅ Seeded ${parents.length} top-level and ${children.length} sub-categories.`);
  }

  async rollback(prisma: PrismaClient): Promise<void> {
    await truncateTable(prisma, 'categories');
    console.info('↩️  CategorySeeder rolled back — "categories" table truncated.');
  }

  private toRow(
    id: number,
    parentId: number | null,
    category: (typeof CATEGORY_TREE)[number],
    createdAt: Date,
  ): Prisma.CategoryCreateManyInput {
    return {
      id,
      parentId,
      name: category.name,
      slug: category.slug,
      iconUrl: unsplashUrl(IMG[category.icon], 'thumb'),
      metaTitle: `${category.name} | Shop Online in Bangladesh`,
      metaDesc: category.metaDesc,
      createdAt,
      updatedAt: createdAt,
    };
  }
}
