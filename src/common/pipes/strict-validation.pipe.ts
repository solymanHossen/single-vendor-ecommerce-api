import { Injectable, ValidationPipe } from '@nestjs/common';

/**
 * Global validation pipe registered via APP_PIPE in AppModule.
 *
 * - whitelist: strips properties not declared in the DTO class
 * - forbidNonWhitelisted: rejects requests containing unknown properties (400)
 * - transform: coerces plain objects into typed DTO instances
 *
 * Implicit conversion is intentionally disabled. Use explicit @Type(() => Number)
 * or @Type(() => Boolean) on individual DTO fields so type coercion is
 * opt-in and auditable rather than happening silently across all inputs.
 *
 * IMPORTANT: this only activates for class-based DTOs (the shape every
 * `create-*.dto.ts`/`update-*.dto.ts` should take going forward) — Nest's
 * ValidationPipe skips validation when a parameter's reflected metatype is
 * a plain `Object`, which is exactly what a `type Foo = z.infer<...>` alias
 * reflects to at runtime. Every DTO in this codebase today (auth, storage)
 * is Zod-based and validated explicitly per-route via ZodValidationPipe
 * instead — those schemas call `.strict()` to get the equivalent
 * unknown-field rejection. This pipe is not dead code: it's the enforcement
 * layer for the first class-based DTO anyone adds.
 */
@Injectable()
export class StrictValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  }
}
