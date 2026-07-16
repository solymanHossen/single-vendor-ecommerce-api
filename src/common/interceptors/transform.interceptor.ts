import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Symmetric success response envelope — shape mirrors ErrorResponseShape from
 * http-exception.filter.ts so API consumers can write isomorphic response handling.
 *
 * Success:  { success: true,  statusCode, timestamp, path, method, message, data }
 * Error:    { success: false, statusCode, timestamp, path, method, message, errors, data: null }
 */
export interface ApiSuccessResponse<T> {
  success: true;
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccessResponse<T>> {
    const httpRequest = context.switchToHttp().getRequest<Request>();
    const httpResponse = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((res: unknown) => {
        const body = res as Record<string, unknown> | null | undefined;

        return {
          success: true as const,
          statusCode: httpResponse.statusCode,
          timestamp: new Date().toISOString(),
          path: httpRequest.url,
          method: httpRequest.method,
          message: typeof body?.message === 'string' ? body.message : 'Success',
          data: (body?.data !== undefined ? body.data : res) as T,
        };
      }),
    );
  }
}
