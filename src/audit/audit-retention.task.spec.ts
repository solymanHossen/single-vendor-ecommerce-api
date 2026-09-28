import { AuditRetentionTask } from './audit-retention.task';
import type { AuditService } from './audit.service';
import type { RedisService } from '../common/redis/redis.service';
import { AUDIT_PURGE_LOCK_KEY } from './audit.constants';

describe('AuditRetentionTask', () => {
  const audit = { purgeExpired: jest.fn(), retentionDays: 90 };
  const client = { set: jest.fn(), del: jest.fn() };
  const task = new AuditRetentionTask(
    audit as unknown as AuditService,
    { client } as unknown as RedisService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    client.del.mockResolvedValue(1);
  });

  it('purges under a lock and releases it', async () => {
    client.set.mockResolvedValueOnce('OK');
    audit.purgeExpired.mockResolvedValueOnce(42);

    await expect(task.run()).resolves.toBe(42);
    expect(client.set).toHaveBeenCalledWith(
      AUDIT_PURGE_LOCK_KEY,
      expect.any(String),
      'EX',
      expect.any(Number),
      'NX',
    );
    expect(client.del).toHaveBeenCalledWith(AUDIT_PURGE_LOCK_KEY);
  });

  it('skips when another instance holds the lock', async () => {
    client.set.mockResolvedValueOnce(null);

    await expect(task.run()).resolves.toBeNull();
    expect(audit.purgeExpired).not.toHaveBeenCalled();
  });

  it('still purges when Redis is unavailable', async () => {
    client.set.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    audit.purgeExpired.mockResolvedValueOnce(3);

    await expect(task.run()).resolves.toBe(3);
  });

  it('never throws out of the scheduler', async () => {
    client.set.mockResolvedValueOnce('OK');
    audit.purgeExpired.mockRejectedValueOnce(new Error('db down'));

    await expect(task.run()).resolves.toBe(0);
    expect(client.del).toHaveBeenCalled();
  });
});
