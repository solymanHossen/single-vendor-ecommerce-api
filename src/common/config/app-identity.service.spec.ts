import type { ConfigService } from '@nestjs/config';
import { AppIdentityService } from './app-identity.service';

function buildConfigService(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    APP_NAME: 'Test Application',
    APP_DESCRIPTION: 'Test Application Description',
    APP_VERSION: '2.3.1',
    ...overrides,
  };

  return {
    getOrThrow: jest.fn((key: string) => {
      const value = values[key];
      if (value === undefined) {
        throw new Error(`Missing required config value: ${key}`);
      }
      return value;
    }),
  } as unknown as ConfigService;
}

describe('AppIdentityService', () => {
  it('exposes name, description, and version read from ConfigService', () => {
    const service = new AppIdentityService(buildConfigService());

    expect(service.name).toBe('Test Application');
    expect(service.description).toBe('Test Application Description');
    expect(service.version).toBe('2.3.1');
  });

  it('reflects whatever APP_* values ConfigService resolves, including env defaults', () => {
    const service = new AppIdentityService(
      buildConfigService({ APP_NAME: 'Application API', APP_VERSION: '1.0.0' }),
    );

    expect(service.name).toBe('Application API');
    expect(service.version).toBe('1.0.0');
  });
});
