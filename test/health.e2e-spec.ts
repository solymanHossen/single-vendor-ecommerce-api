import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, VersioningType, HttpStatus } from '@nestjs/common';
import { HealthCheckError } from '@nestjs/terminus';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { DatabaseHealthIndicator } from '../src/database/db.health';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('HealthController (e2e)', () => {
  describe('When the database is healthy', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();

      app.setGlobalPrefix('api');
      app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
      });

      // Mirroring production pipeline configuration
      app.useGlobalFilters(new HttpExceptionFilter());
      app.useGlobalInterceptors(new TransformInterceptor());

      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /api/v1/health - Should return 200 OK with wrapped status payload', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(HttpStatus.OK);

      // Verifying the actual unified API response structure
      expect(response.body).toEqual(
        expect.objectContaining({
          success: true,
          statusCode: 200,
          message: 'Success',
          data: expect.objectContaining({
            status: 'ok',
            info: expect.objectContaining({
              postgres: { status: 'up' },
            }),
          }),
        }),
      );
    });
  });

  describe('When the database check fails', () => {
    let app: INestApplication;
    const mockDatabaseIndicator = {
      isHealthy: jest.fn().mockImplementation((key: string) => {
        throw new HealthCheckError('Database check failed', {
          [key]: { status: 'down', message: 'Connection timeout' },
        });
      }),
    };

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(DatabaseHealthIndicator)
        .useValue(mockDatabaseIndicator)
        .compile();

      app = moduleFixture.createNestApplication();

      app.setGlobalPrefix('api');
      app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
      });

      // Mirroring production pipeline configuration
      app.useGlobalFilters(new HttpExceptionFilter());
      app.useGlobalInterceptors(new TransformInterceptor());

      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /api/v1/health - Should return 503 Service Unavailable matching standard error structure', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(HttpStatus.SERVICE_UNAVAILABLE);

      // Verifying that the error is properly sanitized by your HttpExceptionFilter
      expect(response.body).toEqual(
        expect.objectContaining({
          success: false,
          statusCode: 503,
          message: expect.any(String),
        }),
      );
    });
  });
});
