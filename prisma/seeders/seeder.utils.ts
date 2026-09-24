import type { Prisma, PrismaClient } from '@prisma/client';

/** Minimal interface for any Prisma model delegate that supports bulk-insert. */
export interface BulkCreateDelegate<T> {
  createMany(args: { data: T[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
}

/**
 * Strict allowlist of table names that seeder scripts are permitted to truncate.
 *
 * SECURITY: truncateTable uses $executeRawUnsafe because PostgreSQL does not support
 * parameterized table names in TRUNCATE statements. This allowlist is the safety
 * boundary — any tableName not present here is rejected before the query executes.
 *
 * When adding a new seeder that truncates a table, register its @@map() name here.
 */
export const SEEDER_TABLE_ALLOWLIST = new Set<string>([
  'users',
  'refresh_tokens',
  'app_settings',
  'addresses',
  'categories',
  'attributes',
  'attribute_options',
  'products',
  'product_images',
  'product_variants',
  'variant_options',
  'coupons',
  'orders',
  'order_items',
  'payments',
  'reviews',
  'review_images',
  'review_replies',
  'wishlists',
  'return_requests',
  'tickets',
  'ticket_messages',
]);

/**
 * Splits an array into non-overlapping chunks of the given size.
 * The final chunk may be smaller than `size`.
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * High-performance table truncation with allowlist validation.
 *
 * RESTART IDENTITY resets auto-increment sequences so IDs begin from 1 on the
 * next seed run. CASCADE silently truncates tables with foreign-key references.
 *
 * @throws {Error} If tableName is not in SEEDER_TABLE_ALLOWLIST — prevents
 *   accidental or injected table names from reaching the database.
 */
export async function truncateTable(prisma: PrismaClient, tableName: string): Promise<void> {
  if (!SEEDER_TABLE_ALLOWLIST.has(tableName)) {
    throw new Error(
      `Seeder safety violation: "${tableName}" is not in SEEDER_TABLE_ALLOWLIST. ` +
        `Add it to seeder.utils.ts to permit truncation.`,
    );
  }

  // tableName is validated against a strict compile-time allowlist above.
  // $executeRawUnsafe is required because TRUNCATE does not support parameterized
  // table identifiers in PostgreSQL — the allowlist is the sole injection barrier.
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE;`);
}

/**
 * Bulk-inserts `data` into `delegate` using chunked createMany calls.
 *
 * Chunking prevents hitting PostgreSQL's 65,535-parameter hard limit and keeps
 * memory usage bounded during large seed runs.
 *
 * @param delegate  A Prisma model delegate (e.g. prisma.user)
 * @param data      Array of records to insert
 * @param chunkSize Rows per INSERT batch (default 5,000)
 * @returns         Total number of rows actually inserted
 */
export async function seedInChunks<T>(
  delegate: BulkCreateDelegate<T>,
  data: T[],
  chunkSize: number = 5_000,
): Promise<number> {
  const chunks = chunkArray(data, chunkSize);
  let totalInserted = 0;

  for (const chunk of chunks) {
    const result = await delegate.createMany({ data: chunk, skipDuplicates: true });
    totalInserted += result.count;
  }

  return totalInserted;
}

function assertAllowlisted(tableName: string): void {
  if (!SEEDER_TABLE_ALLOWLIST.has(tableName)) {
    throw new Error(
      `Seeder safety violation: "${tableName}" is not in SEEDER_TABLE_ALLOWLIST. ` +
        `Add it to seeder.utils.ts to permit truncation.`,
    );
  }
}

/**
 * Truncates several allowlisted tables in ONE statement.
 *
 * A single multi-table TRUNCATE is atomic and lets PostgreSQL resolve the
 * foreign keys between the listed tables itself, so callers never have to
 * order parent/child tables by hand.
 */
export async function truncateTables(
  prisma: PrismaClient,
  tableNames: readonly string[],
): Promise<void> {
  tableNames.forEach(assertAllowlisted);
  const identifiers = tableNames.map((name) => `"${name}"`).join(', ');

  // Every identifier was validated against the compile-time allowlist above.
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${identifiers} RESTART IDENTITY CASCADE;`);
}

/**
 * Re-aligns a table's `id` identity sequence with its current MAX(id).
 *
 * Seeders that insert rows with explicit primary keys (to build a fully
 * linked graph in memory and bulk-insert it without RETURNING round-trips)
 * must call this afterwards — otherwise the application's next INSERT would
 * reuse id 1 and fail with a unique-constraint violation.
 */
export async function resetIdentitySequence(
  prisma: PrismaClient,
  tableName: string,
): Promise<void> {
  assertAllowlisted(tableName);

  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), ` +
      `COALESCE((SELECT MAX(id) FROM "${tableName}"), 1), ` +
      `(SELECT MAX(id) IS NOT NULL FROM "${tableName}"));`,
  );
}

/**
 * Strict chunked bulk insert: unlike {@link seedInChunks} it never skips
 * duplicates, and it fails loudly if the database accepted fewer rows than
 * were built — a silently dropped row would leave dangling references in
 * every seeder that runs after it.
 */
export async function insertAll<T>(
  delegate: BulkCreateDelegate<T>,
  data: readonly T[],
  label: string,
  chunkSize: number = 2_000,
): Promise<number> {
  let inserted = 0;

  for (const chunk of chunkArray([...data], chunkSize)) {
    const result = await delegate.createMany({ data: chunk });
    inserted += result.count;
  }

  if (inserted !== data.length) {
    throw new Error(`${label}: expected to insert ${data.length} rows but inserted ${inserted}.`);
  }

  return inserted;
}

// ── Money ────────────────────────────────────────────────────────────────────
// All seed arithmetic happens in integer poisha (1/100 BDT) so that totals,
// discounts and variant prices never pick up floating-point drift.

export function takaToPoisha(taka: number): number {
  return Math.round(taka * 100);
}

export function decimalToPoisha(value: Prisma.Decimal): number {
  return value.times(100).round().toNumber();
}

/** Formats poisha as the exact decimal string Prisma writes to NUMERIC(12,2). */
export function poishaToMoney(poisha: number): string {
  return (poisha / 100).toFixed(2);
}

// ── Time ─────────────────────────────────────────────────────────────────────

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export function daysAgo(days: number, from: Date = new Date()): Date {
  return new Date(from.getTime() - days * MS_PER_DAY);
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * MS_PER_HOUR);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Clamps a timestamp so derived events (replies, updates) never land in the future. */
export function notAfterNow(date: Date): Date {
  const now = Date.now();
  return date.getTime() > now ? new Date(now) : date;
}

// ── Text ─────────────────────────────────────────────────────────────────────

export function truncateText(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trimEnd()}…`;
}
