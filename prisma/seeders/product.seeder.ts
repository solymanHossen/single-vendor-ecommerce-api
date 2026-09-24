import { PrismaClient, type Prisma } from '@prisma/client';
import { faker } from '@faker-js/faker';
import type { Seeder } from './seeder.interface';
import {
  insertAll,
  resetIdentitySequence,
  truncateTables,
  daysAgo,
  addDays,
  notAfterNow,
  poishaToMoney,
  takaToPoisha,
  truncateText,
} from './seeder.utils';
import { CATEGORY_TREE, PRODUCTS, type OptionSeed, type ProductSeed } from './data/catalog.data';
import { IMG, unsplashUrl } from './data/images.data';
import { optionValue } from './attribute.seeder';

interface ResolvedOption {
  readonly optionId: number;
  readonly value: string;
  readonly pricePoisha: number;
}

/**
 * Short, human-readable SKU segment for an option value: numeric tokens are
 * kept whole ("256GB"), the first word contributes up to three letters and
 * every later word its initial — "Space Gray" → "SPAG", "Disc Edition" →
 * "DISE". The duplicate-SKU guard in seed() catches any residual collision.
 */
function skuSegment(value: string): string {
  const words = value
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(' ')
    .filter((word) => word.length > 0);

  return words
    .map((word, index) => {
      if (/^\d/.test(word)) {
        return word;
      }
      return index === 0 ? word.slice(0, words.length > 1 ? 3 : 4) : word.charAt(0);
    })
    .join('')
    .toUpperCase();
}

/** Cartesian product of the variant axes: [[a1,b1],[a1,b2],[a2,b1],…]. */
function cartesian<T>(axes: readonly (readonly T[])[]): T[][] {
  return axes.reduce<T[][]>(
    (combos, axis) => combos.flatMap((combo) => axis.map((item) => [...combo, item])),
    [[]],
  );
}

function buildDescription(product: ProductSeed): string {
  const highlights = product.features.map((feature) => `• ${feature}`).join('\n');
  return (
    `${product.summary}\n\n` +
    `Highlights\n${highlights}\n\n` +
    `Brand: ${product.brand}. 100% authentic product sourced from authorised distributors. ` +
    `Cash on delivery available across Bangladesh, with 7-day easy returns.`
  );
}

export class ProductSeeder implements Seeder {
  readonly name = 'ProductSeeder';
  readonly description = 'Seeds the product catalog with images, variants and variant options';
  readonly order = 7;

  async seed(prisma: PrismaClient): Promise<void> {
    console.info('🧹 Cleaning product tables...');
    await truncateTables(prisma, [
      'variant_options',
      'product_variants',
      'product_images',
      'products',
    ]);

    const categoryIdBySlug = await this.loadCategoryIds(prisma);
    const optionIdByKey = await this.loadAttributeOptionIds(prisma);
    const skuPrefixBySlug = this.buildSkuPrefixes();
    this.validateCatalog(categoryIdBySlug);

    const products: Prisma.ProductCreateManyInput[] = [];
    const images: Prisma.ProductImageCreateManyInput[] = [];
    const variants: Prisma.ProductVariantCreateManyInput[] = [];
    const variantOptions: Prisma.VariantOptionCreateManyInput[] = [];
    const skuCounterByCategory = new Map<string, number>();
    const seenSkus = new Set<string>();

    for (const seed of PRODUCTS) {
      const productId = products.length + 1;
      const categoryId = categoryIdBySlug.get(seed.categorySlug);
      const skuPrefix = skuPrefixBySlug.get(seed.categorySlug);
      if (categoryId === undefined || skuPrefix === undefined) {
        throw new Error(`Unknown category "${seed.categorySlug}" for product "${seed.slug}".`);
      }

      const sequence = (skuCounterByCategory.get(seed.categorySlug) ?? 0) + 1;
      skuCounterByCategory.set(seed.categorySlug, sequence);
      const sku = `${skuPrefix}-${String(sequence).padStart(3, '0')}`;

      const createdAt = faker.date.between({ from: daysAgo(240), to: daysAgo(5) });
      const updatedAt = faker.date.between({
        from: createdAt,
        to: notAfterNow(addDays(createdAt, 30)),
      });
      const sellingPoisha = takaToPoisha(seed.discountPrice ?? seed.basePrice);

      // ── Variants ──────────────────────────────────────────────────────────
      let totalVariantStock = 0;
      const axes = seed.variantAxes ?? [];

      if (axes.length > 0) {
        const resolvedAxes = axes.map((axis) =>
          axis.options.map((option: OptionSeed): ResolvedOption => {
            const value = optionValue(option);
            const optionId = optionIdByKey.get(`${axis.attribute}::${value}`);
            if (optionId === undefined) {
              throw new Error(`Attribute option "${axis.attribute}: ${value}" was not seeded.`);
            }
            const deltaTaka = typeof option === 'string' ? 0 : option.priceDelta;
            return { optionId, value, pricePoisha: takaToPoisha(deltaTaka) };
          }),
        );

        for (const combo of cartesian(resolvedAxes)) {
          const variantId = variants.length + 1;
          const variantSku = `${sku}-${combo.map((option) => skuSegment(option.value)).join('-')}`;
          if (seenSkus.has(variantSku)) {
            throw new Error(`Duplicate variant SKU generated: ${variantSku}`);
          }
          seenSkus.add(variantSku);

          const stock =
            seed.stock ??
            (faker.datatype.boolean({ probability: 0.1 })
              ? 0
              : faker.number.int({ min: 3, max: 40 }));
          totalVariantStock += stock;

          variants.push({
            id: variantId,
            productId,
            sku: variantSku,
            price: poishaToMoney(
              sellingPoisha + combo.reduce((sum, option) => sum + option.pricePoisha, 0),
            ),
            stockQuantity: stock,
            imageUrl: null,
            createdAt,
            updatedAt,
          });

          for (const option of combo) {
            variantOptions.push({ variantId, attributeOptionId: option.optionId });
          }
        }
      }

      // ── Product ───────────────────────────────────────────────────────────
      products.push({
        id: productId,
        categoryId,
        name: seed.name,
        slug: seed.slug,
        description: buildDescription(seed),
        basePrice: poishaToMoney(takaToPoisha(seed.basePrice)),
        discountPrice:
          seed.discountPrice === undefined ? null : poishaToMoney(takaToPoisha(seed.discountPrice)),
        sku,
        // A variant product's sellable stock is the sum of its variants'.
        stockQuantity:
          axes.length > 0
            ? totalVariantStock
            : (seed.stock ?? faker.number.int({ min: 8, max: 150 })),
        isPublished: seed.isPublished ?? true,
        metaTitle: truncateText(`${seed.name} Price in Bangladesh | Buy Online`, 70),
        metaDesc: truncateText(seed.summary, 160),
        createdAt,
        updatedAt,
      });

      // ── Images ────────────────────────────────────────────────────────────
      seed.images.forEach((imageKey, index) => {
        images.push({
          productId,
          url: unsplashUrl(IMG[imageKey], 'full'),
          isThumbnail: index === 0,
        });
      });
    }

    await insertAll(prisma.product, products, 'products');
    await insertAll(prisma.productImage, images, 'product_images');
    await insertAll(prisma.productVariant, variants, 'product_variants');
    await insertAll(prisma.variantOption, variantOptions, 'variant_options');
    await resetIdentitySequence(prisma, 'products');
    await resetIdentitySequence(prisma, 'product_variants');

    const published = products.filter((product) => product.isPublished).length;
    console.info(
      `✅ Seeded ${products.length} products (${published} published), ${images.length} images, ` +
        `${variants.length} variants and ${variantOptions.length} variant options.`,
    );
  }

  async rollback(prisma: PrismaClient): Promise<void> {
    await truncateTables(prisma, [
      'variant_options',
      'product_variants',
      'product_images',
      'products',
    ]);
    console.info('↩️  ProductSeeder rolled back.');
  }

  private async loadCategoryIds(prisma: PrismaClient): Promise<Map<string, number>> {
    const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
    return new Map(categories.map((category) => [category.slug, category.id]));
  }

  private async loadAttributeOptionIds(prisma: PrismaClient): Promise<Map<string, number>> {
    const options = await prisma.attributeOption.findMany({
      select: { id: true, value: true, attribute: { select: { name: true } } },
    });
    return new Map(
      options.map((option) => [`${option.attribute.name}::${option.value}`, option.id]),
    );
  }

  private buildSkuPrefixes(): Map<string, string> {
    const prefixes = new Map<string, string>();
    for (const parent of CATEGORY_TREE) {
      for (const child of parent.children ?? []) {
        prefixes.set(child.slug, `${parent.code}-${child.code}`);
      }
    }
    return prefixes;
  }

  /** Fails fast on catalog authoring mistakes before anything is written. */
  private validateCatalog(categoryIdBySlug: Map<string, number>): void {
    const leafSlugs = new Set(
      CATEGORY_TREE.flatMap((parent) => (parent.children ?? []).map((child) => child.slug)),
    );
    const slugs = new Set<string>();
    const problems: string[] = [];

    for (const product of PRODUCTS) {
      if (slugs.has(product.slug)) {
        problems.push(`duplicate slug "${product.slug}"`);
      }
      slugs.add(product.slug);

      if (!categoryIdBySlug.has(product.categorySlug) || !leafSlugs.has(product.categorySlug)) {
        problems.push(`"${product.slug}" must reference a seeded leaf category`);
      }
      if (product.discountPrice !== undefined && product.discountPrice >= product.basePrice) {
        problems.push(`"${product.slug}" discountPrice must be lower than basePrice`);
      }
      if (product.images.length === 0) {
        problems.push(`"${product.slug}" needs at least one image`);
      }
    }

    if (problems.length > 0) {
      throw new Error(`Invalid catalog data:\n  - ${problems.join('\n  - ')}`);
    }
  }
}
