<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<h1 align="center">Singlevendor Ecommerce App</h1>

<p align="center">
  A single-vendor e-commerce backend API, built on a production-ready
  NestJS + Prisma + PostgreSQL foundation with the security, observability, and
  infrastructure plumbing that most projects end up re-building from scratch.
</p>

## Features

- **Auth** — JWT access tokens + rotating opaque refresh tokens (hashed at rest), refresh-token
  reuse/theft detection, account lockout after repeated failed logins, password reset via
  emailed one-time tokens, Google OAuth2 login, role-based access control (`USER` /
  `ADMIN` / `SUPER_ADMIN`).
- **Validation** — Zod schemas at the request boundary, layered with a global
  `class-validator` pipe (whitelist + forbid-unknown-properties) as defense in depth.
- **Observability** — structured Winston logging with per-request correlation IDs
  (propagated via `AsyncLocalStorage` and the `X-Correlation-ID` header), Morgan HTTP
  access logs, Terminus health/readiness/liveness endpoints.
- **Rate limiting** — Redis-backed, multi-tier (`@nestjs/throttler`): a loose global
  limit on every route, a tight limit opt-in on sensitive auth endpoints — shared
  correctly across replicas instead of per-instance in-memory counters.
- **Storage** — pluggable file storage (`local` disk or `S3`-compatible), MIME/size
  allow-listing enforced both at the Multer layer and again in the service.
- **Mail** — pluggable outbound mail (`console` provider for zero-config local dev, or
  `smtp` via Nodemailer).
- **Settings** — a runtime, database-backed feature-flag table (e.g. disable
  registration or Google login without a redeploy), gated behind `SUPER_ADMIN`.
- **Everything else you'd expect** — Helmet security headers, gzip/Brotli compression,
  CORS allow-listing, request body size limits, graceful shutdown, Swagger/OpenAPI docs
  (non-production only), soft deletes, and a Zod-validated, fail-fast environment
  config with cross-field checks (e.g. S3 credentials become required the moment you
  set `STORAGE_PROVIDER=cloud`).

## Tech stack

| Concern        | Choice                                                         |
| --------------- | --------------------------------------------------------------- |
| Framework       | [NestJS](https://nestjs.com/) 11 (TypeScript strict mode)       |
| ORM             | [Prisma](https://www.prisma.io/) 7, `@prisma/adapter-pg`         |
| Database        | PostgreSQL                                                       |
| Cache / limiter | Redis (`ioredis`)                                                |
| Validation      | Zod + `class-validator`                                          |
| Auth            | Passport (JWT + Google OAuth2), bcrypt                           |
| Logging         | Winston                                                           |
| Docs            | Swagger / OpenAPI                                                 |
| Testing         | Jest, Supertest                                                   |

## Prerequisites

- Node.js `>= 24`
- PostgreSQL and Redis — run locally, or via the provided `docker-compose.yml`

## Getting started

```bash
git clone <this-repo>
cd nestjs-starter-kit
cp .env.example .env        # then fill in the REQUIRED values (see below)
npm install
```

Start Postgres + Redis (skip this if you already have your own instances — just point
`DATABASE_URL` / `REDIS_URL` at them):

```bash
docker compose up -d postgres redis
```

Sync the Prisma schema and seed a dev super-admin:

```bash
npm run prisma:generate
npm run prisma:push       # no migrations exist yet — see "Database migrations" below
npm run prisma:seed       # creates superadmin@example.com / Password123 (dev/test only)
```

Run the app:

```bash
npm run start:dev
```

- API base URL: `http://localhost:3000/api/v1`
- Swagger docs (non-production only): `http://localhost:3000/api/docs`
- Health check: `http://localhost:3000/api/v1/health/ready`

### Database migrations

This starter ships with a schema (`prisma/schema.prisma`) but no migration history —
`npm run prisma:push` (`prisma db push`) is the fastest way to sync it while you're
still shaping the schema. Once you're ready to track schema changes properly, switch to
migrations:

```bash
npm run prisma:migrate:dev    # generates prisma/migrations + applies it locally
npm run prisma:migrate:prod   # prisma migrate deploy — use this in CI/production instead of db push
```

## Environment variables

Every variable is documented, defaulted where sensible, and validated at startup by a
Zod schema (`src/common/config/env.validation.ts`) — the app refuses to boot with a
missing/invalid value rather than failing later at request time. See
[`.env.example`](.env.example) for the full annotated list (server, database, JWT,
mail, Google OAuth, rate limiting, storage, etc.).

## Scripts

| Script                       | Purpose                                            |
| ----------------------------- | --------------------------------------------------- |
| `npm run start:dev`           | Run with hot reload                                 |
| `npm run build`               | Compile to `dist/`                                  |
| `npm run start:prod`          | Run the compiled build                              |
| `npm run lint`                | ESLint (auto-fix)                                   |
| `npm run type:check`          | `tsc --noEmit`                                       |
| `npm test`                    | Unit tests                                           |
| `npm run test:cov`            | Unit tests with coverage                             |
| `npm run test:e2e`            | End-to-end tests (needs a real Postgres + Redis)     |
| `npm run audit:sec`           | `npm audit --audit-level=high`                       |
| `npm run prisma:studio`       | Prisma's DB GUI                                      |

## Project structure

```text
src/
├── auth/            # register/login/refresh/logout, RBAC guards, JWT + Google strategies
├── common/
│   ├── config/      # env validation, app identity, trust-proxy resolution
│   ├── filters/     # global HTTP + Prisma exception filters
│   ├── interceptors/# response envelope
│   ├── logger/      # Winston logger + correlation-id middleware
│   ├── pipes/       # Zod + strict class-validator pipes
│   └── redis/       # shared ioredis client
├── database/        # PrismaService, DB health indicator
├── health/           # liveness/readiness endpoints (Terminus)
├── mail/             # pluggable mail provider (console | smtp)
├── settings/         # runtime feature-flag store
└── storage/          # pluggable file storage provider (local | s3)
```

Every feature module follows the same shape: `dto/`, `entities/`, `*.module.ts`,
`*.controller.ts` + `*.controller.spec.ts`, `*.service.ts` + `*.service.spec.ts`.

## API overview

All routes are prefixed `/api/v1`. Full request/response contracts are in Swagger
(`/api/docs`) when not running in production.

| Method | Route                        | Auth               | Notes                                  |
| ------ | ----------------------------- | ------------------- | ---------------------------------------- |
| POST   | `/auth/register`              | Public              | Disabled via Settings → `allowRegistration` |
| POST   | `/auth/login`                 | Public              | Sets refresh token as an httpOnly cookie |
| POST   | `/auth/forgot-password`       | Public              | Always returns a generic response        |
| POST   | `/auth/reset-password`        | Public              | Revokes all existing sessions on success |
| POST   | `/auth/refresh`                | Refresh cookie      | Rotates the refresh token                |
| POST   | `/auth/logout`                 | Bearer              | Revokes the current device's session      |
| POST   | `/auth/logout-all`             | Bearer              | Revokes every session for the user        |
| GET    | `/auth/me`                     | Bearer              | Current user profile                      |
| GET    | `/auth/google`                 | Public              | Starts Google OAuth2 flow                 |
| GET    | `/auth/google/callback`        | Public              | Google OAuth2 callback                    |
| GET    | `/settings`                    | `ADMIN`+            | Read feature flags                        |
| PATCH  | `/settings`                    | `SUPER_ADMIN`       | Update feature flags                      |
| POST   | `/storage/upload`              | Bearer              | Multipart upload                          |
| GET    | `/storage/stream/:folder/:file`| Public              | Streams the stored object back            |
| DELETE | `/storage/:folder/:file`       | Bearer              | Deletes a stored object                   |
| GET    | `/health`, `/health/live`, `/health/ready` | Public | Terminus health checks     |

Every successful response is wrapped in a consistent envelope by `TransformInterceptor`:

```json
{
  "success": true,
  "statusCode": 200,
  "timestamp": "2026-01-01T00:00:00.000Z",
  "path": "/api/v1/health/live",
  "method": "GET",
  "message": "Success",
  "data": { "status": "ok" }
}
```

Errors follow the mirrored shape (`success: false`, `errors`) via `HttpExceptionFilter`
and `PrismaClientExceptionFilter`.

## Testing

```bash
npm test          # unit tests
npm run test:cov  # unit tests + coverage report
npm run test:e2e  # end-to-end tests — requires DATABASE_URL/REDIS_URL to point at real instances
```

## Docker

```bash
docker compose up --build
```

This brings up Postgres, Redis, and the app itself (built from the included
multi-stage `Dockerfile`), applying the Prisma schema on container start. Copy
`.env.example` to `.env` first — `docker-compose.yml` reads it via `env_file`.

To run only the infrastructure (Postgres + Redis) and the app on your host with hot
reload, use `docker compose up -d postgres redis` and `npm run start:dev` as shown
above.

## License

[MIT](LICENSE)
# single-vendor-ecommerce-api
