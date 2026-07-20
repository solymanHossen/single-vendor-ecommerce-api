import { z } from 'zod';

/**
 * URL-safe slug: lowercase alphanumeric segments separated by single hyphens
 * (no leading/trailing/double hyphens). Shared between every domain that
 * exposes a human-editable, URL-facing identifier (categories, products, ...).
 */
export const SlugSchema = z
  .string()
  .trim()
  .min(2, 'slug must be at least 2 characters')
  .max(220)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'slug must be lowercase alphanumeric characters separated by single hyphens',
  );
