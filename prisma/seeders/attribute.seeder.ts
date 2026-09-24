import { PrismaClient, type Prisma } from '@prisma/client';
import type { Seeder } from './seeder.interface';
import { insertAll, resetIdentitySequence, truncateTables, daysAgo } from './seeder.utils';
import {
  ATTRIBUTE_NAMES,
  PRODUCTS,
  type AttributeName,
  type OptionSeed,
} from './data/catalog.data';

export function optionValue(option: OptionSeed): string {
  return typeof option === 'string' ? option : option.value;
}

/**
 * Collects every option value actually used by a product variant, per
 * attribute, preserving first-seen order (so "S, M, L, XL" stays in size
 * order rather than being sorted alphabetically).
 */
export function collectAttributeOptions(): Map<AttributeName, string[]> {
  const optionsByAttribute = new Map<AttributeName, string[]>();

  for (const product of PRODUCTS) {
    for (const axis of product.variantAxes ?? []) {
      const values = optionsByAttribute.get(axis.attribute) ?? [];
      for (const option of axis.options) {
        const value = optionValue(option);
        if (!values.includes(value)) {
          values.push(value);
        }
      }
      optionsByAttribute.set(axis.attribute, values);
    }
  }

  return optionsByAttribute;
}

export class AttributeSeeder implements Seeder {
  readonly name = 'AttributeSeeder';
  readonly description = 'Seeds variant attributes (Color, Size, Storage…) and their options';
  readonly order = 6;

  async seed(prisma: PrismaClient): Promise<void> {
    console.info('🧹 Cleaning "attributes" and "attribute_options" tables...');
    await truncateTables(prisma, ['attribute_options', 'attributes']);

    const optionsByAttribute = collectAttributeOptions();
    const createdAt = daysAgo(365);
    const attributes: Prisma.AttributeCreateManyInput[] = [];
    const options: Prisma.AttributeOptionCreateManyInput[] = [];

    // Iterate the canonical name list (not the map) for a stable id order.
    for (const name of ATTRIBUTE_NAMES) {
      const values = optionsByAttribute.get(name);
      if (!values || values.length === 0) {
        continue;
      }

      const attributeId = attributes.length + 1;
      attributes.push({ id: attributeId, name, createdAt, updatedAt: createdAt });

      for (const value of values) {
        options.push({
          id: options.length + 1,
          attributeId,
          value,
          createdAt,
          updatedAt: createdAt,
        });
      }
    }

    await insertAll(prisma.attribute, attributes, 'attributes');
    await insertAll(prisma.attributeOption, options, 'attribute_options');
    await resetIdentitySequence(prisma, 'attributes');
    await resetIdentitySequence(prisma, 'attribute_options');

    console.info(`✅ Seeded ${attributes.length} attributes with ${options.length} options.`);
  }

  async rollback(prisma: PrismaClient): Promise<void> {
    await truncateTables(prisma, ['attribute_options', 'attributes']);
    console.info('↩️  AttributeSeeder rolled back.');
  }
}
