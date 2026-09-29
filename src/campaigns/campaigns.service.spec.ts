import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { CampaignsService } from './campaigns.service';
import { slugify } from './campaigns.constants';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const actor: AuthUser = {
  id: 1,
  email: 'o@x.com',
  role: Role.SUPER_ADMIN,
  isActive: true,
  permissions: [],
};

const prisma = {
  campaign: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  campaignProduct: { deleteMany: jest.fn(), createMany: jest.fn() },
  campaignCategory: { deleteMany: jest.fn(), createMany: jest.fn() },
  product: { count: jest.fn() },
  category: { count: jest.fn() },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
};
const pricing = { invalidate: jest.fn(), productIdsFor: jest.fn() };
const catalog = { listProducts: jest.fn() };
const audit = { record: jest.fn() };

const base = {
  name: 'Eid Mega Sale',
  discountType: 'PERCENTAGE' as const,
  discountValue: 20,
  startsAt: '2026-10-01T00:00:00.000Z',
  endsAt: '2026-10-10T00:00:00.000Z',
  isActive: true,
  isFeatured: false,
  productIds: [5],
  categoryIds: [],
};

describe('CampaignsService', () => {
  let service: CampaignsService;
  let findOne: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new CampaignsService(
      prisma as never,
      pricing as never,
      catalog as never,
      audit as never,
    );
    findOne = jest.spyOn(service, 'findOne').mockResolvedValue({} as never);
    prisma.product.count.mockResolvedValue(1);
    prisma.category.count.mockResolvedValue(0);
    prisma.campaign.findUnique.mockResolvedValue(null);
    prisma.campaign.create.mockResolvedValue({ id: 3, name: 'Eid Mega Sale' });
  });

  it('slugifies names', () => {
    expect(slugify('Eid Mega Sale 2026!')).toBe('eid-mega-sale-2026');
  });

  it('derives status from publish flag and clock', () => {
    const now = new Date('2026-10-05');
    const at = (startsAt: string, endsAt: string, isActive = true) =>
      service.statusOf({ isActive, startsAt: new Date(startsAt), endsAt: new Date(endsAt) }, now);
    expect(at('2026-10-01', '2026-10-10', false)).toBe('DRAFT');
    expect(at('2026-10-06', '2026-10-10')).toBe('SCHEDULED');
    expect(at('2026-10-01', '2026-10-10')).toBe('LIVE');
    expect(at('2026-09-01', '2026-10-01')).toBe('ENDED');
  });

  it('creates with an automatic slug, refreshes prices and audits', async () => {
    await service.create(base, { actor, ip: '::1' });
    const args = prisma.campaign.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(args.data).toMatchObject({
      slug: 'eid-mega-sale',
      isActive: true,
      maxDiscountAmount: null,
    });
    expect(pricing.invalidate).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'campaign.created' }),
    );
    expect(findOne).toHaveBeenCalledWith(3);
  });

  it('de-duplicates an automatic slug', async () => {
    prisma.campaign.findUnique
      .mockResolvedValueOnce({ id: 9, name: 'Old' })
      .mockResolvedValueOnce(null);
    await service.create(base);
    const args = prisma.campaign.create.mock.calls[0][0] as { data: { slug: string } };
    expect(args.data.slug).toBe('eid-mega-sale-2');
  });

  it('refuses a taken custom slug', async () => {
    prisma.campaign.findUnique.mockResolvedValueOnce({ id: 9, name: 'Old' });
    await expect(service.create({ ...base, slug: 'eid' })).rejects.toThrow(ConflictException);
  });

  it.each([
    [{ discountValue: 95 }, 'at most 90%'],
    [{ endsAt: '2026-09-01T00:00:00.000Z' }, 'end must be after'],
    [{ productIds: [], categoryIds: [] }, 'at least one product'],
  ])('rejects an incoherent campaign %#', async (overrides, message) => {
    await expect(service.create({ ...base, ...overrides })).rejects.toThrow(
      expect.objectContaining({ message: expect.stringContaining(message) }) as Error,
    );
    expect(prisma.campaign.create).not.toHaveBeenCalled();
  });

  it('lets a draft be saved without products', async () => {
    await expect(
      service.create({ ...base, isActive: false, productIds: [] }),
    ).resolves.toBeDefined();
  });

  it('rejects unknown products', async () => {
    prisma.product.count.mockResolvedValueOnce(0);
    await expect(service.create(base)).rejects.toThrow(BadRequestException);
  });

  it('keeps campaigns that sold something', async () => {
    prisma.campaign.findUnique.mockResolvedValueOnce({ name: 'Eid', _count: { orderItems: 4 } });
    await expect(service.remove(3)).rejects.toThrow(ConflictException);
    expect(prisma.campaign.delete).not.toHaveBeenCalled();
  });

  it('ends a live campaign now', async () => {
    prisma.campaign.findUnique.mockResolvedValueOnce({
      name: 'Eid',
      startsAt: new Date(Date.now() - 86_400_000),
      endsAt: new Date(Date.now() + 86_400_000),
    });
    await service.endNow(3);
    const args = prisma.campaign.update.mock.calls[0][0] as { data: { endsAt: Date } };
    expect(Math.abs(args.data.endsAt.getTime() - Date.now())).toBeLessThan(5000);
    expect(pricing.invalidate).toHaveBeenCalled();
  });

  it('features only when the live campaign has products', async () => {
    prisma.campaign.findFirst.mockResolvedValueOnce({
      id: 3,
      name: 'Eid',
      slug: 'eid',
      tagline: null,
      description: null,
      discountType: 'PERCENTAGE',
      discountValue: new Prisma.Decimal(20),
      maxDiscountAmount: null,
      startsAt: new Date(0),
      endsAt: new Date(Date.now() + 1e7),
      isActive: true,
      isFeatured: true,
      bannerUrl: null,
      accentColor: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { products: 1, categories: 0 },
    });
    pricing.productIdsFor.mockResolvedValueOnce([]);
    await expect(service.featured()).resolves.toBeNull();
  });
});
