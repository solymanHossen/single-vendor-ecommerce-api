import { PrismaClient } from '@prisma/client';
import { Seeder } from './seeder.interface';

// These `imageKey` values are placeholders — the seeded images are external
// Unsplash URLs, not files this app's own storage actually manages, so
// there's nothing real for a later delete to clean up (StorageService.remove
// no-ops safely on a key that was never written).
const HERO_BANNERS = [
  {
    placement: 'MAIN' as const,
    title: 'Next-Gen Gaming Rigs & RTX Flash Sale',
    href: '/shop?category=gaming-pc',
    imageUrl:
      'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1400&q=80',
    imageKey: 'seed/hero-banner-1',
    sortOrder: 0,
  },
  {
    placement: 'MAIN' as const,
    title: 'New Season Fashion Collection',
    href: '/shop?category=fashion',
    imageUrl:
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1400&q=80',
    imageKey: 'seed/hero-banner-2',
    sortOrder: 1,
  },
  {
    placement: 'MAIN' as const,
    title: 'Hi-Fi Wireless Audio & ANC Headphones',
    href: '/shop?category=audio',
    imageUrl:
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1400&q=80',
    imageKey: 'seed/hero-banner-3',
    sortOrder: 2,
  },
  {
    placement: 'SIDE' as const,
    title: 'MacBook Air M3 Series Offer',
    href: '/product/macbook-air-m3',
    imageUrl:
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80',
    imageKey: 'seed/hero-banner-4',
    sortOrder: 0,
  },
  {
    placement: 'SIDE' as const,
    title: 'AirPods Pro 2nd Gen Offer',
    href: '/product/airpods-pro-2',
    imageUrl:
      'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80',
    imageKey: 'seed/hero-banner-5',
    sortOrder: 1,
  },
];

export class HeroBannerSeeder implements Seeder {
  readonly name = 'HeroBannerSeeder';
  readonly description = 'Seeds the homepage main-slider and side-card hero banners';

  async seed(prisma: PrismaClient): Promise<void> {
    console.log('🖼️  Cleaning "hero_banners" table...');
    await prisma.heroBanner.deleteMany({});

    console.log(`📦 Inserting ${HERO_BANNERS.length} hero banners...`);
    await prisma.heroBanner.createMany({ data: HERO_BANNERS });

    console.log('✅ Successfully seeded hero banners.');
  }

  async rollback(prisma: PrismaClient): Promise<void> {
    await prisma.heroBanner.deleteMany({});
    console.log('↩️  HeroBannerSeeder rolled back — "hero_banners" table truncated.');
  }
}
