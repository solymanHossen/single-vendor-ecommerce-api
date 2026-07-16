/**
 * Names of the two throttler tiers configured in AppModule's
 * ThrottlerModule.forRootAsync. Kept in their own file (rather than declared
 * in app.module.ts) so feature modules — e.g. HealthController's
 * @SkipThrottle({ [name]: true }) — can reference them without importing
 * AppModule and creating a circular dependency.
 *
 * @Throttle({ auth: { limit: 10, ttl: 900_000 } }) is the opt-in override for
 * sensitive endpoints (login, register, refresh); @SkipThrottle({ global: true,
 * auth: true }) is the opt-out for endpoints that must never depend on Redis
 * (e.g. health checks).
 */
export const GLOBAL_THROTTLE_KEY = 'global' as const;
export const AUTH_THROTTLE_KEY = 'auth' as const;
