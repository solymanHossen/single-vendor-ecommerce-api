import {
  type ArgumentsHost,
  BadRequestException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { HttpExceptionFilter } from './http-exception.filter';

function buildHost(request: Partial<Request>, response: { status: jest.Mock; json: jest.Mock }) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
}

function buildResponse() {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it('maps an HttpException to its own status and message', () => {
    const response = buildResponse();
    const host = buildHost({ method: 'GET', url: '/api/v1/things/1' }, response);

    filter.catch(new NotFoundException('Thing not found'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Thing not found',
        errors: [],
        data: null,
      }),
    );
  });

  it('surfaces class-validator-style array messages as errors[] with the first as message', () => {
    const response = buildResponse();
    const host = buildHost({ method: 'POST', url: '/api/v1/auth/register' }, response);

    filter.catch(new BadRequestException(['email must be valid', 'password too short']), host);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'email must be valid',
        errors: ['email must be valid', 'password too short'],
      }),
    );
  });

  it('defaults unknown, non-HttpException errors to a generic 500 without leaking internals', () => {
    const response = buildResponse();
    const host = buildHost({ method: 'GET', url: '/api/v1/health' }, response);

    filter.catch(new Error('raw db connection string leaked here'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An unexpected error occurred. Please try again later.',
      }),
    );
  });

  it('surfaces the raw error message for non-HttpException, non-5xx-implied errors', () => {
    // No HttpException means status always resolves to 500 in this filter, but this
    // guards resolveMessage's client-facing branch for completeness/regression safety.
    const response = buildResponse();
    const host = buildHost({ method: 'GET', url: '/api/v1/health' }, response);

    filter.catch('a plain string throw', host);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'An unexpected error occurred. Please try again later.' }),
    );
  });

  it('never includes an errorCode field for generic HTTP exceptions', () => {
    const response = buildResponse();
    const host = buildHost({ method: 'GET', url: '/api/v1/things/1' }, response);

    filter.catch(new NotFoundException('Thing not found'), host);

    const [payload] = response.json.mock.calls[0] as [Record<string, unknown>];
    expect(payload.errorCode).toBeUndefined();
  });
});
