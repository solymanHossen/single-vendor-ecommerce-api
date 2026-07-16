import { BadRequestException } from '@nestjs/common';
import { IsString } from 'class-validator';
import { StrictValidationPipe } from './strict-validation.pipe';

class SampleClassDto {
  @IsString()
  name!: string;
}

describe('StrictValidationPipe', () => {
  let pipe: StrictValidationPipe;

  beforeEach(() => {
    pipe = new StrictValidationPipe();
  });

  it('transforms a clean payload into a class-based DTO instance', async () => {
    const result = await pipe.transform(
      { name: 'Ada' },
      { type: 'body', metatype: SampleClassDto },
    );

    expect(result).toBeInstanceOf(SampleClassDto);
    expect(result).toEqual({ name: 'Ada' });
  });

  it('rejects a class-based DTO payload containing unrecognized properties', async () => {
    await expect(
      pipe.transform({ name: 'Ada', role: 'ADMIN' }, { type: 'body', metatype: SampleClassDto }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a class-based DTO payload failing its own field validators', async () => {
    await expect(
      pipe.transform({ name: 42 }, { type: 'body', metatype: SampleClassDto }),
    ).rejects.toThrow(BadRequestException);
  });

  it('is a documented no-op for plain-Object metatypes — this is why Zod DTOs bypass it', async () => {
    // Every DTO in this codebase today (RegisterDto, LoginDto, UploadFileDto)
    // is `type X = z.infer<typeof Schema>` — a type alias, not a class — which
    // reflects to the `Object` metatype at runtime. Nest's ValidationPipe
    // intentionally skips validation for this metatype, so this pipe applies
    // no whitelist/forbidNonWhitelisted enforcement to those routes; they
    // instead validate via ZodValidationPipe + `.strict()` on the schema.
    const payload = { anything: 'goes', extra: 'fields', are: 'preserved' };

    const result = await pipe.transform(payload, { type: 'body', metatype: Object });

    expect(result).toEqual(payload);
  });
});
