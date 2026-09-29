import { z } from 'zod';
import {
  CAMPAIGN_STATUSES,
  MAX_CAMPAIGN_CATEGORIES,
  MAX_CAMPAIGN_PRODUCTS,
  SLUG_PATTERN,
} from '../campaigns.constants';

const MAX_AMOUNT = 999_999_999.99;

const FIELDS = {
  name: z.string().trim().min(3, 'name must be at least 3 characters').max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(80)
    .regex(SLUG_PATTERN, 'slug may only use lowercase letters, numbers and single hyphens'),
  tagline: z.string().trim().max(160),
  description: z.string().trim().max(2000),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
  discountValue: z.number().positive().max(MAX_AMOUNT),
  maxDiscountAmount: z.number().positive().max(MAX_AMOUNT),
  // ISO strings (see coupons): a Date schema can't be expressed in JSON Schema.
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  bannerUrl: z.string().trim().url().max(1000),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'accentColor must be a hex colour like #0f766e'),
  productIds: z.array(z.number().int().positive()).max(MAX_CAMPAIGN_PRODUCTS),
  categoryIds: z.array(z.number().int().positive()).max(MAX_CAMPAIGN_CATEGORIES),
};

export const CreateCampaignSchema = z
  .object({
    name: FIELDS.name,
    slug: FIELDS.slug.optional(),
    tagline: FIELDS.tagline.optional(),
    description: FIELDS.description.optional(),
    discountType: FIELDS.discountType,
    discountValue: FIELDS.discountValue,
    maxDiscountAmount: FIELDS.maxDiscountAmount.optional(),
    startsAt: FIELDS.startsAt,
    endsAt: FIELDS.endsAt,
    isActive: FIELDS.isActive.default(false),
    isFeatured: FIELDS.isFeatured.default(false),
    bannerUrl: FIELDS.bannerUrl.optional(),
    accentColor: FIELDS.accentColor.optional(),
    productIds: FIELDS.productIds.default([]),
    categoryIds: FIELDS.categoryIds.default([]),
  })
  .strict();

export type CreateCampaignDto = z.infer<typeof CreateCampaignSchema>;

// Cross-field rules are checked by the service on the merged campaign.
export const UpdateCampaignSchema = z
  .object({
    name: FIELDS.name.optional(),
    slug: FIELDS.slug.optional(),
    tagline: FIELDS.tagline.nullable().optional(),
    description: FIELDS.description.nullable().optional(),
    discountType: FIELDS.discountType.optional(),
    discountValue: FIELDS.discountValue.optional(),
    maxDiscountAmount: FIELDS.maxDiscountAmount.nullable().optional(),
    startsAt: FIELDS.startsAt.optional(),
    endsAt: FIELDS.endsAt.optional(),
    isActive: FIELDS.isActive.optional(),
    isFeatured: FIELDS.isFeatured.optional(),
    bannerUrl: FIELDS.bannerUrl.nullable().optional(),
    accentColor: FIELDS.accentColor.nullable().optional(),
    productIds: FIELDS.productIds.optional(),
    categoryIds: FIELDS.categoryIds.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateCampaignDto = z.infer<typeof UpdateCampaignSchema>;

export const AdminCampaignQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum([...CAMPAIGN_STATUSES, 'ALL']).default('ALL'),
    search: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export type AdminCampaignQueryDto = z.infer<typeof AdminCampaignQuerySchema>;
