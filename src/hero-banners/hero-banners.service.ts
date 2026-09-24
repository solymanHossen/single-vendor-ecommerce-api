import { Injectable } from '@nestjs/common';
import type { HeroBannerPlacement, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateHeroBannerDto } from './dto/create-hero-banner.dto';
import { UpdateHeroBannerDto } from './dto/update-hero-banner.dto';
import { ReorderHeroBannersDto } from './dto/reorder-hero-banners.dto';
import { HeroBannerEntity } from './entities/hero-banner.entity';

const HERO_BANNER_SELECT = {
  id: true,
  placement: true,
  title: true,
  href: true,
  imageUrl: true,
  imageKey: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.HeroBannerSelect;

type HeroBannerRow = Prisma.HeroBannerGetPayload<{ select: typeof HERO_BANNER_SELECT }>;

@Injectable()
export class HeroBannersService {
  constructor(
    private readonly prisma: PrismaService,
    // StorageModule is @Global() — no import needed to inject this.
    private readonly storageService: StorageService,
  ) {}

  async findPublic(placement?: HeroBannerPlacement): Promise<HeroBannerEntity[]> {
    const rows = await this.prisma.heroBanner.findMany({
      where: { isActive: true, ...(placement ? { placement } : {}) },
      select: HERO_BANNER_SELECT,
      // id breaks ties so banners sharing a sortOrder still render in a
      // stable, predictable order instead of whatever Postgres returns.
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    return rows.map((row) => this.toEntity(row));
  }

  async findAllForAdmin(): Promise<HeroBannerEntity[]> {
    const rows = await this.prisma.heroBanner.findMany({
      select: HERO_BANNER_SELECT,
      orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    });

    return rows.map((row) => this.toEntity(row));
  }

  async create(dto: CreateHeroBannerDto): Promise<HeroBannerEntity> {
    // Without an explicit position, a new banner goes to the END of its
    // placement. Defaulting to 0 (the column default) would tie it with the
    // current first banner, and a tie can't be fixed by swapping positions.
    const sortOrder = dto.sortOrder ?? (await this.nextSortOrder(dto.placement));

    const created = await this.prisma.heroBanner.create({
      data: { ...dto, sortOrder },
      select: HERO_BANNER_SELECT,
    });

    return this.toEntity(created);
  }

  async update(id: number, dto: UpdateHeroBannerDto): Promise<HeroBannerEntity> {
    const updated = await this.prisma.heroBanner.update({
      where: { id },
      data: dto,
      select: HERO_BANNER_SELECT,
    });

    return this.toEntity(updated);
  }

  private async nextSortOrder(placement: HeroBannerPlacement): Promise<number> {
    const { _max } = await this.prisma.heroBanner.aggregate({
      where: { placement },
      _max: { sortOrder: true },
    });
    return _max.sortOrder === null ? 0 : _max.sortOrder + 1;
  }

  async reorder(dto: ReorderHeroBannersDto): Promise<void> {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.heroBanner.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
          select: { id: true },
        }),
      ),
    );
  }

  async remove(id: number): Promise<void> {
    const banner = await this.prisma.heroBanner.findUniqueOrThrow({
      where: { id },
      select: { imageKey: true },
    });

    // DB row is the source of truth — delete it first, then best-effort clean
    // up the file. If storage cleanup fails, the row is already gone either
    // way, so that shouldn't surface as a failed delete to the admin.
    await this.prisma.heroBanner.delete({ where: { id } });
    await this.storageService.remove(banner.imageKey).catch(() => undefined);
  }

  private toEntity(row: HeroBannerRow): HeroBannerEntity {
    return new HeroBannerEntity(row);
  }
}
