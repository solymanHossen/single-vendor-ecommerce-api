import type { Prisma } from '@prisma/client';

export interface PricedProduct {
  basePrice: Prisma.Decimal;
  discountPrice: Prisma.Decimal | null;
}

export interface PricedVariant {
  price: Prisma.Decimal;
}

/**
 * The one pricing rule shared by cart, quote and checkout.
 *
 * A variant's `price` is its selling price (sale already applied). When the
 * product is on sale, the variant's "was" price is the base price plus the
 * same option surcharge — exactly what the product page shows.
 */
export function linePrice(
  product: PricedProduct,
  variant: PricedVariant | null,
): { unitPrice: Prisma.Decimal; compareAtPrice: Prisma.Decimal | null } {
  const selling = product.discountPrice ?? product.basePrice;
  if (!variant) {
    return { unitPrice: selling, compareAtPrice: product.discountPrice ? product.basePrice : null };
  }
  if (!product.discountPrice) return { unitPrice: variant.price, compareAtPrice: null };
  const compareAt = product.basePrice.plus(variant.price.minus(selling));
  return {
    unitPrice: variant.price,
    compareAtPrice: compareAt.greaterThan(variant.price) ? compareAt : null,
  };
}

/** "Black · 256GB" from a variant's options (already ordered by id). */
export function variantLabel(options: ReadonlyArray<{ value: string }>): string | null {
  return options.length > 0 ? options.map((option) => option.value).join(' · ') : null;
}
