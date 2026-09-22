import { ApiProperty } from '@nestjs/swagger';
import type { HeroBannerPlacement } from '@prisma/client';

interface HeroBannerEntityInput {
  id: number;
  placement: HeroBannerPlacement;
  title: string;
  href: string;
  imageUrl: string;
  imageKey: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class HeroBannerEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ enum: ['MAIN', 'SIDE'], example: 'MAIN' })
  placement: HeroBannerPlacement;

  @ApiProperty({ example: 'Next-Gen Gaming Rigs & RTX Flash Sale' })
  title: string;

  @ApiProperty({ example: '/shop?category=gaming-pc' })
  href: string;

  @ApiProperty({ example: 'http://localhost:3000/api/v1/storage/stream/hero-banners/abc.jpg' })
  imageUrl: string;

  @ApiProperty({ example: 'hero-banners/abc.jpg' })
  imageKey: string;

  @ApiProperty({ example: 0 })
  sortOrder: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: HeroBannerEntityInput) {
    this.id = partial.id;
    this.placement = partial.placement;
    this.title = partial.title;
    this.href = partial.href;
    this.imageUrl = partial.imageUrl;
    this.imageKey = partial.imageKey;
    this.sortOrder = partial.sortOrder;
    this.isActive = partial.isActive;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}
