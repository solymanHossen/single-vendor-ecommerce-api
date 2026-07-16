import { z } from 'zod';

const originPattern = /^(\*|https?:\/\/[^\s,]+)$/;

// Semantic Versioning 2.0.0 core grammar (major.minor.patch), with optional
// -prerelease and +build metadata suffixes (e.g. "1.4.2-beta.1+build.7").
const semverPattern =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export const envSchema = z
  .object({
    // ── Runtime ──────────────────────────────────────────────────────────────
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    PORT: z.coerce
      .number()
      .int()
      .min(1, 'PORT must be ≥ 1')
      .max(65535, 'PORT must be ≤ 65535')
      .default(3000),

    // Interface to bind the HTTP server to. '0.0.0.0' (default) accepts
    // connections on every interface — required for the app to be reachable
    // from outside its own container in Docker/Kubernetes. Override to a
    // specific address (e.g. '127.0.0.1') to restrict to loopback-only.
    HOST: z.string().default('0.0.0.0'),

    // ── Application metadata ────────────────────────────────────────────────
    // Backs AppIdentityService (src/common/config/app-identity.service.ts) —
    // the single source of truth every other module (Swagger docs, outbound
    // email templates, future audit logs) reads app name/description/version
    // from, instead of each hardcoding its own copy.
    APP_NAME: z.string().min(1, 'APP_NAME must not be empty').default('Application API'),
    APP_DESCRIPTION: z
      .string()
      .min(1, 'APP_DESCRIPTION must not be empty')
      .default('API Documentation'),
    APP_VERSION: z
      .string()
      .regex(semverPattern, 'APP_VERSION must be a valid semantic version (e.g. 1.0.0)')
      .default('1.0.0'),

    // ── Database ────────────────────────────────────────────────────────────
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection URL'),

    // Max connections in the pg.Pool. Size proportionally to PostgreSQL's
    // max_connections divided by the number of app replicas.
    DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

    // Milliseconds to wait before giving up acquiring a new connection from the pool.
    DB_CONN_TIMEOUT_MS: z.coerce.number().int().min(0).default(3000),

    // Milliseconds an idle connection is kept open before being released.
    DB_IDLE_TIMEOUT_MS: z.coerce.number().int().min(0).default(30000),

    // Milliseconds a query will wait to acquire a row/table lock before
    // failing fast, separate from — and shorter than — DB_STATEMENT_TIMEOUT_MS.
    // Without this, a query queued behind a lock occupies a pool connection
    // for the full statement timeout before erroring, instead of failing
    // fast on the specific contention.
    DB_LOCK_TIMEOUT_MS: z.coerce.number().int().min(0).default(5000),

    // Milliseconds before Postgres cancels any single running statement,
    // preventing a runaway query from exhausting the connection pool.
    DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(0).default(30000),

    // Set to 'true' to enforce SSL on all DB connections. Defaults to true
    // in production automatically; override with 'false' for dev/staging DBs
    // that run without SSL (e.g. local Docker Postgres).
    DB_SSL: z.preprocess(
      (v) => (v === 'true' ? true : v === 'false' ? false : v),
      z.boolean().optional(),
    ),

    // ── Request limits ──────────────────────────────────────────────────────
    // Express body-parser limit — expressed as a byte string (e.g. '10mb', '512kb').
    BODY_SIZE_LIMIT: z.string().default('10mb'),

    // ── CORS ────────────────────────────────────────────────────────────────
    // Comma-separated list of allowed origins, each must be a valid URL or '*'.
    // Example: https://app.example.com,https://admin.example.com
    ALLOWED_ORIGINS: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          return val
            .split(',')
            .map((o) => o.trim())
            .every((origin) => originPattern.test(origin));
        },
        {
          message:
            'ALLOWED_ORIGINS must be a comma-separated list of valid URLs (e.g. https://app.com) or the wildcard "*"',
        },
      ),

    // ── JWT ─────────────────────────────────────────────────────────────────
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_ACCESS_EXPIRES_IN: z
      .string()
      .regex(/^\d+[smhd]$/, 'JWT_ACCESS_EXPIRES_IN must match pattern: <number><s|m|h|d>')
      .default('15m'),
    JWT_REFRESH_EXPIRES_IN: z
      .string()
      .regex(/^\d+[smhd]$/, 'JWT_REFRESH_EXPIRES_IN must match pattern: <number><s|m|h|d>')
      .default('7d'),

    // ── Bcrypt ──────────────────────────────────────────────────────────────
    BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

    // ── Account security ────────────────────────────────────────────────────
    MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
    LOCK_DURATION_MINUTES: z.coerce.number().int().min(1).default(15),
    PASSWORD_RESET_TOKEN_EXPIRES_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),

    // ── Outbound mail ────────────────────────────────────────────────────────
    // 'console' (default) logs the email instead of sending it — zero-config,
    // works out of the box in local dev/CI. 'smtp' sends for real via nodemailer
    // and requires the SMTP_* variables below.
    MAIL_PROVIDER: z.enum(['console', 'smtp']).default('console'),
    MAIL_FROM: z.string().default('no-reply@example.com'),
    SMTP_HOST: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    SMTP_PORT: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.coerce.number().int().min(1).max(65535).optional(),
    ),
    SMTP_USER: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    SMTP_PASSWORD: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    SMTP_SECURE: z.preprocess(
      (v) => (v === 'true' ? true : v === 'false' ? false : v),
      z.boolean().optional(),
    ),

    // ── Google OAuth (optional) ─────────────────────────────────────────────
    GOOGLE_CLIENT_ID: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    GOOGLE_CLIENT_SECRET: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    GOOGLE_CALLBACK_URL: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().url().optional(),
    ),

    // ── Public app URL ──────────────────────────────────────────────────────
    // Used to build absolute links back to this API (e.g. file streaming URLs).
    // Required behind a reverse proxy/CDN in production; falls back to
    // http://localhost:<PORT> when unset — fine for local development only.
    APP_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),

    // ── Reverse proxy trust ──────────────────────────────────────────────────
    // Controls Express's `trust proxy` setting, which governs how `req.ip` (and
    // therefore the Throttler's per-client tracking) is derived from
    // X-Forwarded-For. Accepted values:
    //   'false'            — trust nothing (default); safe when the app is
    //                        reachable directly, but IP-based rate limiting
    //                        will bucket every client behind the same NAT/proxy.
    //   'true'             — trust the nearest hop unconditionally; only safe
    //                        if you are certain no untrusted client can reach
    //                        the app directly (spoofable otherwise).
    //   a positive integer — trust exactly that many hops from the client.
    //   anything else      — passed through verbatim as an Express subnet/
    //                        keyword list (e.g. 'loopback, 10.0.0.0/8').
    TRUST_PROXY: z.string().default('false'),

    // ── Distributed rate-limit storage ───────────────────────────────────────
    // Required unconditionally, same as DATABASE_URL — the Throttler's storage
    // must be shared across replicas, so an in-memory fallback is not offered.
    REDIS_URL: z.string().url('REDIS_URL must be a valid connection URL'),

    // ── Storage Infrastructure ──────────────────────────────────────────────
    STORAGE_PROVIDER: z.enum(['local', 'cloud']).default('local'),
    LOCAL_STORAGE_DEST: z.string().default('./storage'),

    // Hard ceiling on a single uploaded file, enforced by Multer before the
    // payload is fully buffered into memory.
    STORAGE_MAX_FILE_SIZE_MB: z.coerce.number().int().min(1).max(1024).default(10),

    // Comma-separated MIME allow-list applied at the Multer layer and again
    // (defense-in-depth) in StorageService. Deliberately fails closed: an
    // empty/unset value falls back to the safe image+PDF default below
    // rather than disabling the check, so an operator can't accidentally
    // open uploads to arbitrary file types (e.g. .html, enabling stored XSS
    // via the public file-stream route) by leaving this blank.
    STORAGE_ALLOWED_MIME_TYPES: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().default('image/jpeg,image/png,image/webp,image/gif,application/pdf'),
    ),

    STORAGE_AWS_ACCESS_KEY_ID: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().optional(),
    ),
    STORAGE_AWS_SECRET_ACCESS_KEY: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().optional(),
    ),
    STORAGE_AWS_REGION: z.string().default('us-east-1'),
    STORAGE_AWS_BUCKET_NAME: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    STORAGE_AWS_ENDPOINT: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().url().optional(),
    ),
  })
  .superRefine((config, ctx) => {
    // Cross-field guard: the S3 provider cannot construct a client without these,
    // and failing fast at startup beats a 500 on the first upload request.
    if (config.STORAGE_PROVIDER !== 'cloud') return;

    if (!config.STORAGE_AWS_ACCESS_KEY_ID) {
      ctx.addIssue({
        code: 'custom',
        path: ['STORAGE_AWS_ACCESS_KEY_ID'],
        message: 'STORAGE_AWS_ACCESS_KEY_ID is required when STORAGE_PROVIDER=cloud',
      });
    }
    if (!config.STORAGE_AWS_SECRET_ACCESS_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['STORAGE_AWS_SECRET_ACCESS_KEY'],
        message: 'STORAGE_AWS_SECRET_ACCESS_KEY is required when STORAGE_PROVIDER=cloud',
      });
    }
    if (!config.STORAGE_AWS_BUCKET_NAME) {
      ctx.addIssue({
        code: 'custom',
        path: ['STORAGE_AWS_BUCKET_NAME'],
        message: 'STORAGE_AWS_BUCKET_NAME is required when STORAGE_PROVIDER=cloud',
      });
    }
  })
  .superRefine((config, ctx) => {
    // Cross-field guard: SmtpMailProvider cannot construct a transport without these,
    // and failing fast at startup beats a 500 on the first password-reset request.
    if (config.MAIL_PROVIDER !== 'smtp') return;

    if (!config.SMTP_HOST) {
      ctx.addIssue({
        code: 'custom',
        path: ['SMTP_HOST'],
        message: 'SMTP_HOST is required when MAIL_PROVIDER=smtp',
      });
    }
    if (!config.SMTP_PORT) {
      ctx.addIssue({
        code: 'custom',
        path: ['SMTP_PORT'],
        message: 'SMTP_PORT is required when MAIL_PROVIDER=smtp',
      });
    }
    if (!config.SMTP_USER) {
      ctx.addIssue({
        code: 'custom',
        path: ['SMTP_USER'],
        message: 'SMTP_USER is required when MAIL_PROVIDER=smtp',
      });
    }
    if (!config.SMTP_PASSWORD) {
      ctx.addIssue({
        code: 'custom',
        path: ['SMTP_PASSWORD'],
        message: 'SMTP_PASSWORD is required when MAIL_PROVIDER=smtp',
      });
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    // Log ONLY the failed variable names — never their values — to prevent
    // secret leakage in startup logs or log aggregation systems.
    const fieldErrors = result.error.flatten().fieldErrors;
    const failed = Object.entries(fieldErrors)
      .map(([key, messages]) => `  ${key}: ${(messages ?? []).join('; ')}`)
      .join('\n');

    console.error(`❌ Environment validation failed:\n${failed}`);
    throw new Error('Environment validation failed — check the variables listed above.');
  }

  return result.data;
}
