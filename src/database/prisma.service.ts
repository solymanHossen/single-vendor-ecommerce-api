import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/** Maximum number of DB connection attempts during startup. */
const MAX_STARTUP_RETRIES = 5;

/** Base delay in milliseconds for exponential backoff (doubles each attempt). */
const BASE_RETRY_DELAY_MS = 1_000;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor(configService: ConfigService) {
    // Collect all pool configuration before calling super() — pool is constructed
    // before PrismaClient initializes, so all values must be resolved here.
    const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');
    const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
    const poolMax = configService.get<number>('DB_POOL_MAX') ?? 10;
    const connTimeoutMs = configService.get<number>('DB_CONN_TIMEOUT_MS') ?? 3_000;
    const idleTimeoutMs = configService.get<number>('DB_IDLE_TIMEOUT_MS') ?? 30_000;
    const lockTimeoutMs = configService.get<number>('DB_LOCK_TIMEOUT_MS') ?? 5_000;
    const statementTimeoutMs = configService.get<number>('DB_STATEMENT_TIMEOUT_MS') ?? 30_000;

    // SSL: honour explicit DB_SSL override; fall back to enabled in production.
    const dbSslOverride = configService.get<boolean>('DB_SSL');
    const sslEnabled = dbSslOverride !== undefined ? dbSslOverride : nodeEnv === 'production';

    const poolInstance = new Pool({
      connectionString: databaseUrl,
      max: poolMax,
      connectionTimeoutMillis: connTimeoutMs,
      idleTimeoutMillis: idleTimeoutMs,
      // Enforce TLS in production; allow plaintext in local/CI environments.
      ssl: sslEnabled ? { rejectUnauthorized: true } : false,
      // Prevent silent TCP connection drops from cloud LBs and firewalls.
      // Without keepalive, idle sockets can be closed mid-flight causing ECONNRESET.
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      // statement_timeout hard-kills any single statement running too long, preventing
      // a runaway query from exhausting the connection pool. lock_timeout fails fast
      // specifically on lock contention — separate and shorter than statement_timeout —
      // so a query queued behind another transaction's lock doesn't tie up a connection
      // for the full statement timeout before erroring.
      // application_name tags each connection in pg_stat_activity for observability.
      options: `-c statement_timeout=${statementTimeoutMs} -c lock_timeout=${lockTimeoutMs} -c application_name=nestjs_app`,
    });

    const adapter = new PrismaPg(poolInstance);
    super({ adapter });

    this.pool = poolInstance;
  }

  async onModuleInit(): Promise<void> {
    await this.connectWithRetry();
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      await this.pool.end();
      this.logger.log('📉 Prisma client and pg pool closed gracefully.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Error during DB disconnect: ${message}`);
    }
  }

  /**
   * Attempts a connectivity probe with exponential backoff.
   *
   * Retries up to MAX_STARTUP_RETRIES times, doubling the delay each round
   * (1 s → 2 s → 4 s → 8 s). This prevents hard crash-loops when the database
   * container starts after the application (common in Docker Compose / k8s).
   */
  private async connectWithRetry(): Promise<void> {
    for (let attempt = 1; attempt <= MAX_STARTUP_RETRIES; attempt++) {
      try {
        await this.$queryRaw`SELECT 1`;
        this.logger.log('✅ DB connected successfully via Prisma Pg-Adapter.');
        return;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);

        if (attempt === MAX_STARTUP_RETRIES) {
          this.logger.error(
            `❌ DB connection failed after ${MAX_STARTUP_RETRIES} attempts: ${message}`,
          );
          throw new Error(
            `Database connection failed after ${MAX_STARTUP_RETRIES} attempts: ${message}`,
          );
        }

        const delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        this.logger.warn(
          `⚠️  DB connection attempt ${attempt}/${MAX_STARTUP_RETRIES} failed — ` +
            `retrying in ${delayMs}ms... (${message})`,
        );
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}
