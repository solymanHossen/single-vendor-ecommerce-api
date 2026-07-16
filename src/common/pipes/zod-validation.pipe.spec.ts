import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const schema = z.object({ email: z.string().email() }).strict();

  it('returns the parsed value when validation succeeds', () => {
    const pipe = new ZodValidationPipe(schema);

    expect(pipe.transform({ email: 'user@example.com' })).toEqual({
      email: 'user@example.com',
    });
  });

  it('throws BadRequestException with the schema issue messages on failure', () => {
    const pipe = new ZodValidationPipe(schema);

    expect(() => pipe.transform({ email: 'not-an-email' })).toThrow(BadRequestException);

    try {
      pipe.transform({ email: 'not-an-email' });
    } catch (error: unknown) {
      const response = (error as BadRequestException).getResponse();
      expect(response).toEqual(
        expect.objectContaining({ message: expect.arrayContaining([expect.any(String)]) }),
      );
    }
  });

  it('rejects unrecognized fields when the schema is .strict()', () => {
    const pipe = new ZodValidationPipe(schema);

    expect(() => pipe.transform({ email: 'user@example.com', role: 'ADMIN' })).toThrow(
      BadRequestException,
    );
  });
});
