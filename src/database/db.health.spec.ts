import { HealthCheckError } from '@nestjs/terminus';
import type { PrismaService } from './prisma.service';
import { DatabaseHealthIndicator } from './db.health';

const mockQueryRaw = jest.fn();

function buildPrismaService(): PrismaService {
  return { $queryRaw: mockQueryRaw } as unknown as PrismaService;
}

describe('DatabaseHealthIndicator', () => {
  let indicator: DatabaseHealthIndicator;

  beforeEach(() => {
    jest.clearAllMocks();
    indicator = new DatabaseHealthIndicator(buildPrismaService());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports healthy when the query resolves before the timeout', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

    const result = await indicator.isHealthy('postgres');

    expect(result).toEqual({ postgres: { status: 'up' } });
  });

  it('throws a sanitized HealthCheckError when the query rejects', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('connection refused'));

    await expect(indicator.isHealthy('postgres')).rejects.toBeInstanceOf(HealthCheckError);

    mockQueryRaw.mockRejectedValueOnce(new Error('connection refused'));
    await expect(indicator.isHealthy('postgres')).rejects.toMatchObject({
      causes: { postgres: { status: 'down', message: 'Database is unavailable' } },
    });
  });

  it('never leaks the raw internal error message to the caller', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('password authentication failed for user "app"'));

    try {
      await indicator.isHealthy('postgres');
      throw new Error('expected isHealthy to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(HealthCheckError);
      expect(JSON.stringify((error as HealthCheckError).causes)).not.toContain(
        'password authentication failed',
      );
    }
  });

  it('times out and reports unhealthy when the query hangs indefinitely', async () => {
    jest.useFakeTimers();
    mockQueryRaw.mockImplementation(() => new Promise(() => undefined));

    const resultPromise = indicator.isHealthy('postgres');
    const assertion = expect(resultPromise).rejects.toBeInstanceOf(HealthCheckError);

    await jest.advanceTimersByTimeAsync(2_000);

    await assertion;
  });
});
