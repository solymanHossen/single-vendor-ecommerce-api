import { Test, type TestingModule } from '@nestjs/testing';
import {
  HealthCheckService,
  MemoryHealthIndicator,
  type HealthCheckResult,
} from '@nestjs/terminus';
import { DatabaseHealthIndicator } from '../database/db.health';
import { HealthController } from './health.controller';

const mockHealthCheckResult: HealthCheckResult = {
  status: 'ok',
  info: { postgres: { status: 'up' }, memory_heap: { status: 'up' } },
  error: {},
  details: { postgres: { status: 'up' }, memory_heap: { status: 'up' } },
};

const mockHealthCheckService = {
  check: jest.fn(),
};

const mockDbIndicator = {
  isHealthy: jest.fn(),
};

const mockMemoryIndicator = {
  checkHeap: jest.fn(),
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockHealthCheckService.check.mockResolvedValue(mockHealthCheckResult);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: DatabaseHealthIndicator, useValue: mockDbIndicator },
        { provide: MemoryHealthIndicator, useValue: mockMemoryIndicator },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('liveness()', () => {
    it('returns ok without touching any downstream indicator', () => {
      const result = controller.liveness();

      expect(result.status).toBe('ok');
      expect(typeof result.timestamp).toBe('string');
      expect(mockHealthCheckService.check).not.toHaveBeenCalled();
      expect(mockDbIndicator.isHealthy).not.toHaveBeenCalled();
    });
  });

  describe('readiness()', () => {
    it('delegates to HealthCheckService with the db and memory indicators', async () => {
      const result = await controller.readiness();

      expect(result).toEqual(mockHealthCheckResult);
      expect(mockHealthCheckService.check).toHaveBeenCalledTimes(1);

      const checks = mockHealthCheckService.check.mock.calls[0][0] as Array<() => unknown>;
      expect(checks).toHaveLength(2);

      const [dbCheck, memoryCheck] = checks;
      if (!dbCheck || !memoryCheck) {
        throw new Error('Expected exactly two health checks to be registered');
      }

      await dbCheck();
      expect(mockDbIndicator.isHealthy).toHaveBeenCalledWith('postgres');

      await memoryCheck();
      expect(mockMemoryIndicator.checkHeap).toHaveBeenCalledWith('memory_heap', 300 * 1024 * 1024);
    });
  });

  describe('check() (legacy combined endpoint)', () => {
    it('delegates to the same indicator set as readiness()', async () => {
      const result = await controller.check();

      expect(result).toEqual(mockHealthCheckResult);
      expect(mockHealthCheckService.check).toHaveBeenCalledTimes(1);
    });
  });
});
