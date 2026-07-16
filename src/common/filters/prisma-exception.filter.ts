import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response, Request } from 'express';
import type { ErrorResponseShape } from './http-exception.filter';

interface ResolvedError {
  status: HttpStatus;
  message: string;
  errorCode: string;
}

/**
 * Catches all three Prisma error classes and maps them to clean HTTP responses
 * without exposing internal ORM details (table names, constraint names, raw causes).
 *
 * Execution order: registered last in AppModule → runs first in the filter chain.
 * If a Prisma error falls through here, the HttpExceptionFilter catches it as a 500.
 */
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientValidationError,
  Prisma.PrismaClientInitializationError,
)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaClientExceptionFilter.name);

  catch(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientValidationError
      | Prisma.PrismaClientInitializationError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, errorCode } = this.resolveError(exception);

    const errorResponse: ErrorResponseShape = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      errors: [],
      errorCode,
      data: null,
    };

    const prismaCode =
      exception instanceof Prisma.PrismaClientKnownRequestError
        ? exception.code
        : exception.constructor.name;

    this.logger.warn(
      `[${request.method}] ${request.url} → ${status} | ${prismaCode} (${errorCode}) | ${message}`,
    );

    response.status(status).json(errorResponse);
  }

  private resolveError(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientValidationError
      | Prisma.PrismaClientInitializationError,
  ): ResolvedError {
    // ── PrismaClientValidationError ──────────────────────────────────────────
    // Triggered when the application passes wrong argument types to a Prisma
    // query (e.g. string where Int is expected). This is always a client bug,
    // not a user input error — surface a 400 with a generic message.
    if (exception instanceof Prisma.PrismaClientValidationError) {
      this.logger.error(
        'PrismaClientValidationError — a Prisma query received invalid arguments.',
        exception.message,
      );
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Invalid request data. Please check your input and try again.',
        errorCode: 'INVALID_QUERY_ARGUMENT',
      };
    }

    // ── PrismaClientInitializationError ──────────────────────────────────────
    // Database unreachable at query time (after startup). The startup check in
    // PrismaService.onModuleInit should catch this first, but network flaps can
    // cause it mid-flight.
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      this.logger.error(
        'PrismaClientInitializationError — database connection failed.',
        exception.message,
      );
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'The service is temporarily unavailable. Please retry your request.',
        errorCode: 'DATABASE_UNAVAILABLE',
      };
    }

    // ── PrismaClientKnownRequestError ─────────────────────────────────────────
    return this.resolveKnownError(exception);
  }

  private resolveKnownError(exception: Prisma.PrismaClientKnownRequestError): ResolvedError {
    switch (exception.code) {
      case 'P2002': {
        // Unique constraint violated. Expose the field name(s) for UX, but not
        // the raw internal constraint name.
        const target = Array.isArray(exception.meta?.['target'])
          ? (exception.meta['target'] as string[]).join(', ')
          : 'field';
        return {
          status: HttpStatus.CONFLICT,
          message: `A record with this ${target} already exists.`,
          errorCode: 'UNIQUE_CONSTRAINT_VIOLATION',
        };
      }

      case 'P2003': {
        // Foreign key constraint failed. Intentionally omit the raw database
        // constraint/field name (e.g. "post_author_id_fkey") to prevent schema leakage.
        return {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          message: 'Foreign key constraint failed. Ensure all referenced records exist.',
          errorCode: 'FOREIGN_KEY_CONSTRAINT_VIOLATION',
        };
      }

      case 'P2014': {
        return {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          message: 'The change violates a required relation between records.',
          errorCode: 'REQUIRED_RELATION_VIOLATION',
        };
      }

      case 'P2025': {
        // Record not found. Do NOT use exception.meta?.cause — it contains raw
        // Prisma/ORM internals (model names, operation descriptions). Use a static
        // message to prevent internal schema enumeration.
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'The requested resource was not found.',
          errorCode: 'RECORD_NOT_FOUND',
        };
      }

      case 'P2024': {
        return {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Database connection pool timed out. Please retry your request.',
          errorCode: 'CONNECTION_POOL_TIMEOUT',
        };
      }

      case 'P2011': {
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'A required field is missing or null.',
          errorCode: 'NULL_CONSTRAINT_VIOLATION',
        };
      }

      case 'P2012': {
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'A required value is missing in the request.',
          errorCode: 'MISSING_REQUIRED_VALUE',
        };
      }

      default: {
        this.logger.error(`Unhandled Prisma error code: ${exception.code}`, exception.stack);
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'A database error occurred. Please try again later.',
          errorCode: 'DATABASE_ERROR',
        };
      }
    }
  }
}
