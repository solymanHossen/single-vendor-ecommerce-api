import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, VersioningType, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { type App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Application bootstrap (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Mirrors main.ts's production bootstrap so this exercises the actual
    // deployed request pipeline, not a bare, unconfigured Nest app.
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / returns 404 — there is no unversioned, unprefixed root route', async () => {
    await request(app.getHttpServer()).get('/').expect(HttpStatus.NOT_FOUND);
  });

  it('GET /api/v1/health/live confirms the global prefix + URI versioning are wired', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(HttpStatus.OK);

    // TransformInterceptor should have wrapped the handler's plain return value.
    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        statusCode: HttpStatus.OK,
        data: expect.objectContaining({ status: 'ok' }),
      }),
    );
  });

  it('GET /api/v1/auth/me without a token is rejected by the global JwtAuthGuard', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(HttpStatus.UNAUTHORIZED);

    // HttpExceptionFilter should have wrapped the rejection in the standard error envelope.
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.UNAUTHORIZED,
      }),
    );
  });
});
