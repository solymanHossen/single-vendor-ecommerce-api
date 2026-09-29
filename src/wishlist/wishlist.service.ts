import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CampaignPricingService } from '../campaigns/campaign-pricing.service';
import { applyCampaign, type CampaignOffer } from '../campaigns/campaign-pricing';
import { CreateWishlistItemDto } from './dto/create-wishlist-item.dto';
import { WishlistItemEntity, WishlistProductSummaryEntity } from './entities/wishlist-item.entity';

const WISHLIST_ITEM_SELECT = {
  id: true,
  productId: true,
  createdAt: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      categoryId: true,
      basePrice: true,
      discountPrice: true,
      images: { select: { url: true }, orderBy: { isThumbnail: 'desc' }, take: 1 },
    },
  },
} satisfies Prisma.WishlistSelect;

type WishlistItemRow = Prisma.WishlistGetPayload<{ select: typeof WISHLIST_ITEM_SELECT }>;

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignPricing: CampaignPricingService,
  ) {}

  async findAll(userId: number): Promise<WishlistItemEntity[]> {
    const rows = await this.prisma.wishlist.findMany({
      where: { userId },
      select: WISHLIST_ITEM_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    const offers = await this.campaignPricing.offersFor(rows.map((row) => row.product));
    return rows.map((row) => this.toEntity(row, offers.get(row.productId)));
  }

  async create(userId: number, dto: CreateWishlistItemDto): Promise<WishlistItemEntity> {
    // productId is a plain scalar assignment (not a nested `connect`), so a
    // reference to a product that doesn't exist fails the FK constraint at
    // the database level (P2003 → 422) rather than needing a manual check
    // here. Re-wishlisting the same product hits the (userId, productId)
    // unique constraint (P2002 → 409) — both translated by
    // PrismaClientExceptionFilter.
    const wishlistItem = await this.prisma.wishlist.create({
      data: { userId, productId: dto.productId },
      select: WISHLIST_ITEM_SELECT,
    });

    const offers = await this.campaignPricing.offersFor([wishlistItem.product]);
    return this.toEntity(wishlistItem, offers.get(wishlistItem.productId));
  }

  async remove(userId: number, productId: number): Promise<void> {
    const result = await this.prisma.wishlist.deleteMany({ where: { userId, productId } });

    if (result.count === 0) {
      throw new NotFoundException('Product is not in the wishlist.');
    }
  }

  private toEntity(wishlistItem: WishlistItemRow, offers?: CampaignOffer[]): WishlistItemEntity {
    const regular = wishlistItem.product.discountPrice ?? wishlistItem.product.basePrice;
    const { unitPrice } = applyCampaign({ unitPrice: regular, compareAtPrice: null }, offers);

    return new WishlistItemEntity({
      id: wishlistItem.id,
      productId: wishlistItem.productId,
      product: new WishlistProductSummaryEntity({
        id: wishlistItem.product.id,
        name: wishlistItem.product.name,
        slug: wishlistItem.product.slug,
        price: unitPrice,
        imageUrl: wishlistItem.product.images[0]?.url ?? null,
      }),
      createdAt: wishlistItem.createdAt,
    });
  }
}
