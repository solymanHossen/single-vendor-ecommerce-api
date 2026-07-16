import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from './prisma.service';

/** Maximum milliseconds to wait for the health-check query before declaring degraded. */
const HEALTH_CHECK_TIMEOUT_MS = 2_000;

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(DatabaseHealthIndicator.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    let timeoutHandle: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(
            () =>
              reject(
                new Error(`Database health check timed out after ${HEALTH_CHECK_TIMEOUT_MS}ms`),
              ),
            HEALTH_CHECK_TIMEOUT_MS,
          );
        }),
      ]);

      return this.getStatus(key, true);
    } catch (error: unknown) {
      const internalMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log the full detail internally for observability tooling.
      this.logger.error(`Database health check failed: ${internalMessage}`);

      // Surface only a generic message externally — raw DB errors must never
      // reach load-balancer health endpoints or public monitoring dashboards.
      throw new HealthCheckError(
        'Database health check failed',
        this.getStatus(key, false, { message: 'Database is unavailable' }),
      );
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
