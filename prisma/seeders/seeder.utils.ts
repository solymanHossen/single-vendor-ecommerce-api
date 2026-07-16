import type { PrismaClient } from '@prisma/client';

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
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE;`,
  );
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
