import { type ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { PrismaClientExceptionFilter } from './prisma-exception.filter';

function buildHost(request: Partial<Request>, response: { status: jest.Mock; json: jest.Mock }) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
}

function buildResponse() {
  const response = { status: jest.fn(), json: jest.fn() };
  response.status.mockReturnValue(response);
  return response;
}

describe('PrismaClientExceptionFilter', () => {
  let filter: PrismaClientExceptionFilter;

  beforeEach(() => {
    filter = new PrismaClientExceptionFilter();
  });

  it('maps P2002 (unique constraint) to 409 with the offending field named', () => {
    const response = buildResponse();
    const host = buildHost({ method: 'POST', url: '/api/v1/auth/register' }, response);
    const exception = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.8.0',
      meta: { target: ['email'] },
    });

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'A record with this email already exists.',
        errorCode: 'UNIQUE_CONSTRAINT_VIOLATION',
      }),
    );
  });

  it('maps P2025 (record not found) to 404 without leaking Prisma internals', () => {
    const response = buildResponse();
    const host = buildHost({ method: 'DELETE', url: '/api/v1/storage/general/x.png' }, response);
    const exception = new Prisma.PrismaClientKnownRequestError('Record to delete not found', {
      code: 'P2025',
      clientVersion: '7.8.0',
      meta: { cause: 'Record was deleted concurrently by another process' },
    });

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const [payload] = response.json.mock.calls[0] as [Record<string, unknown>];
    expect(payload.message).toBe('The requested resource was not found.');
    expect(payload.errorCode).toBe('RECORD_NOT_FOUND');
    expect(JSON.stringify(payload)).not.toContain('concurrently');
  });

  it('maps an unrecognized Prisma error code to a generic 500 DATABASE_ERROR', () => {
    const response = buildResponse();
    const host = buildHost({ method: 'GET', url: '/api/v1/auth/me' }, response);
    const exception = new Prisma.PrismaClientKnownRequestError('Something obscure happened', {
      code: 'P9999',
      clientVersion: '7.8.0',
    });

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'A database error occurred. Please try again later.',
        errorCode: 'DATABASE_ERROR',
      }),
    );
  });

  it('maps PrismaClientValidationError to 400 INVALID_QUERY_ARGUMENT', () => {
    const response = buildResponse();
    const host = buildHost({ method: 'POST', url: '/api/v1/auth/login' }, response);
    const exception = new Prisma.PrismaClientValidationError('Invalid `where` argument type', {
      clientVersion: '7.8.0',
    });

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'INVALID_QUERY_ARGUMENT' }),
    );
  });

  it('maps PrismaClientInitializationError to 503 DATABASE_UNAVAILABLE', () => {
    const response = buildResponse();
    const host = buildHost({ method: 'GET', url: '/api/v1/health/ready' }, response);
    const exception = new Prisma.PrismaClientInitializationError(
      'Can not reach database server',
      '7.8.0',
    );

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'DATABASE_UNAVAILABLE' }),
    );
  });
});
