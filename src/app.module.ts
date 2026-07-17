import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, type ThrottlerModuleOptions } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { StorageModule } from './storage/storage.module';
import { SettingsModule } from './settings/settings.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { AttributesModule } from './attributes/attributes.module';
import { ProductVariantsModule } from './product-variants/product-variants.module';
import { UsersModule } from './users/users.module';
import { AddressesModule } from './addresses/addresses.module';
import { MailModule } from './mail/mail.module';
import { AppIdentityModule } from './common/config/app-identity.module';
import { validateEnv } from './common/config/env.validation';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaClientExceptionFilter } from './common/filters/prisma-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { StrictValidationPipe } from './common/pipes/strict-validation.pipe';
import { LoggerModule } from './common/logger/logger.module';
import { RedisModule } from './common/redis/redis.module';
import { RedisService } from './common/redis/redis.service';
import { AUTH_THROTTLE_KEY, GLOBAL_THROTTLE_KEY } from './common/constants/throttler.constants';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),

    // ── Multi-tier rate limiting, backed by Redis ──────────────────────────────
    // Tier 1 "global": 100 requests / 10-minute window — applied to all routes.
    // Tier 2 "auth":   10 requests / 15-minute window — opt-in via @Throttle({ auth: { ... } })
    //                  on sensitive endpoints (login, register, password-reset).
    // IMPORTANT — verified against the installed @nestjs/throttler@6.5.0
    // source and confirmed live against Redis via MONITOR: `ttl` and
    // `blockDuration` are in MILLISECONDS, not seconds. (The package's own
    // in-memory ThrottlerStorageService passes `ttl` straight into
    // `setTimeout()`, and this Redis-backed storage passes it straight into
    // `PEXPIRE`/`PX` — both millisecond-based.) Configuring these in seconds
    // silently shrinks a "10 requests / 15 minutes" window down to
    // "10 requests / 900 milliseconds", defeating the limiter almost entirely.
    // Storage is Redis (not the package default in-memory map) so every
    // replica behind a load balancer enforces the same limit against the
    // same shared counters, instead of each instance tracking its own.
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redisService: RedisService): ThrottlerModuleOptions => ({
        throttlers: [
          { name: GLOBAL_THROTTLE_KEY, ttl: 600_000, limit: 100 },
          { name: AUTH_THROTTLE_KEY, ttl: 900_000, limit: 10 },
        ],
        storage: new ThrottlerStorageRedisService(redisService.client),
      }),
    }),

    AppIdentityModule,
    RedisModule,
    LoggerModule,
    DatabaseModule,
    MailModule,
    HealthModule,
    AuthModule,
    StorageModule,
    SettingsModule,
    CategoriesModule,
    ProductsModule,
    AttributesModule,
    ProductVariantsModule,
    UsersModule,
    AddressesModule,
  ],
  providers: [
    // ── Global validation pipe ────────────────────────────────────────────────
    // Enforces whitelist stripping + forbidNonWhitelisted + type transformation
    // on every incoming request body. Registered via DI so it participates in the
    // NestJS DI container (unlike app.useGlobalPipes which is DI-unaware).
    {
      provide: APP_PIPE,
      useClass: StrictValidationPipe,
    },

    // ── Response transformer (wraps every successful handler return) ──────────
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },

    // ── Guards — evaluated in registration order ──────────────────────────────
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },

    // ── Exception filters — last-registered = first-executed ─────────────────
    // HttpExceptionFilter: registered first → outermost catch-all fallback
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    // PrismaClientExceptionFilter: registered last → runs first, handles all Prisma errors
    { provide: APP_FILTER, useClass: PrismaClientExceptionFilter },
  ],
})
export class AppModule {}
