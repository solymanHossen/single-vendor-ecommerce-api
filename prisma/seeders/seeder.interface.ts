import type { PrismaClient } from '@prisma/client';

export interface Seeder {
  /** Display name shown in seed progress output */
  readonly name: string;
  /** Optional human-readable description of what this seeder does */
  readonly description?: string;
  /**
   * Execution order hint. Lower numbers run first when seeders are
   * sorted automatically. Defaults to registration array order when omitted.
   */
  readonly order?: number;
  /** Primary seed operation */
  seed(prisma: PrismaClient): Promise<void>;
  /** Optional teardown that reverses this seeder's changes (useful for e2e test cleanup) */
  rollback?(prisma: PrismaClient): Promise<void>;
}
