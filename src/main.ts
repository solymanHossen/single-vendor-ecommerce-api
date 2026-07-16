import { NestFactory } from '@nestjs/core';
import { Logger, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { EnterpriseLoggerService } from './common/logger/enterprise-logger.service';
import { CorrelationIdMiddleware } from './common/logger/correlation-id.middleware';
import { resolveTrustProxy } from './common/config/resolve-trust-proxy.util';
import { AppIdentityService } from './common/config/app-identity.service';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  // bodyParser: false — disabled so we can configure size limits explicitly below.
  // bufferLogs: true — queues every framework startup log instead of printing
  // it through Nest's default console logger; they're flushed through
  // EnterpriseLoggerService the moment `app.useLogger()` runs below, so no
  // bootstrap output is lost or logged twice.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });

  // ── Unified logging (replaces Nest's default ConsoleLogger app-wide) ────────
  // Every `Logger` instance anywhere in the app — including ones already
  // constructed above, and Morgan's stream below — now routes through this
  // Winston-backed, correlation-id-aware logger automatically.
  app.useLogger(app.get(EnterpriseLoggerService));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3000;
  const host = configService.get<string>('HOST') ?? '0.0.0.0';
  const env = configService.get<string>('NODE_ENV') ?? 'development';
  const bodyLimit = configService.get<string>('BODY_SIZE_LIMIT') ?? '10mb';

  // Single source of truth for app name/description/version — see
  // AppIdentityService for why this replaces reading APP_* keys here directly.
  const appIdentity = app.get(AppIdentityService);

  // Graceful shutdown: NestJS calls onModuleDestroy/onApplicationShutdown on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  // ── Reverse proxy trust ──────────────────────────────────────────────────
  // Governs how `req.ip` (and therefore Throttler tracking) is derived from
  // X-Forwarded-For. Defaults to `false` (trust nothing) unless TRUST_PROXY
  // is explicitly configured — see env.validation.ts for accepted formats.
  const trustProxyRaw = configService.get<string>('TRUST_PROXY') ?? 'false';
  app.set('trust proxy', resolveTrustProxy(trustProxyRaw));

  // ── Correlation ID (must run before Morgan, so every request's log line —
  // and everything downstream — can read the id via AsyncLocalStorage) ───────
  const correlationIdMiddleware = app.get(CorrelationIdMiddleware);
  app.use(correlationIdMiddleware.use.bind(correlationIdMiddleware));

  // ── Body parsing with explicit size limits ─────────────────────────────────
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  // ── Gzip/Brotli response compression ───────────────────────────────────────
  app.use(compression());

  // ── Security headers ────────────────────────────────────────────────────────
  // CSP is relaxed in non-production so Swagger UI (inline scripts/styles) renders.
  app.use(
    helmet({
      contentSecurityPolicy: env === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: env === 'production',
    }),
  );

  app.use(cookieParser());

  const httpLogger = new Logger('HTTP');
  app.use(
    morgan(env === 'development' ? 'dev' : 'combined', {
      stream: { write: (message: string) => httpLogger.log(message.trim()) },
    }),
  );

  // ── CORS ───────────────────────────────────────────────────────────────────
  const allowedOrigins = configService.get<string>('ALLOWED_ORIGINS');
  app.enableCors({
    origin:
      env === 'development'
        ? true
        : allowedOrigins
          ? allowedOrigins.split(',').map((o) => o.trim())
          : false,
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // ── Swagger (non-production only) ──────────────────────────────────────────
  if (env !== 'production') {
    const swaggerDescription =
      `${appIdentity.description}\n\n` +
      `## How to authenticate\n\n` +
      `1. Call **POST /api/v1/auth/register** or **POST /api/v1/auth/login**.\n` +
      `2. Copy the \`accessToken\` value from the \`data\` object in the response.\n` +
      `3. Click the **Authorize 🔓** button (top-right of this page).\n` +
      `4. Paste the token into the **Value** field — no \`Bearer \` prefix needed — then click **Authorize**.\n` +
      `5. Close the dialog. All 🔒 padlocked endpoints now include \`Authorization: Bearer <token>\` automatically.`;

    const swaggerConfig = new DocumentBuilder()
      .setTitle(appIdentity.name)
      .setDescription(swaggerDescription)
      .setVersion(appIdentity.version)
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token — obtain it from POST /auth/login.',
        },
        'bearer',
      )
      .addCookieAuth('refresh_token', {
        type: 'apiKey',
        in: 'cookie',
        name: 'refresh_token',
        description: 'HTTP-only refresh token — set automatically by POST /auth/login.',
      })
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
      customSiteTitle: `${appIdentity.name} – API Docs`,
    });

    logger.log(`📚 Swagger Docs:  http://localhost:${port}/api/docs`);
  }
  // ──────────────────────────────────────────────────────────────────────────

  await app.listen(port, host);

  logger.log(
    `🚀 App running in [${env}] mode on: http://localhost:${port}/api/v1 (bound to ${host})`,
  );
  logger.log(`🏥 Health Check:  http://localhost:${port}/api/v1/health/ready`);
}

bootstrap().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  new Logger('Bootstrap').fatal(`💥 Fatal startup error: ${message}`);
  process.exit(1);
});
