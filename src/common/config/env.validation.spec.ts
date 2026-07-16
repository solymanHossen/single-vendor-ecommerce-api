import { validateEnv } from './env.validation';

function buildValidConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/app',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    REDIS_URL: 'redis://localhost:6379',
    ...overrides,
  };
}

describe('validateEnv', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('accepts a minimal valid config and fills in defaults', () => {
    const result = validateEnv(buildValidConfig());

    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3000);
    expect(result.MAIL_PROVIDER).toBe('console');
    expect(result.STORAGE_PROVIDER).toBe('local');
  });

  it('coerces numeric string env vars to numbers', () => {
    const result = validateEnv(buildValidConfig({ PORT: '4000', DB_POOL_MAX: '25' }));

    expect(result.PORT).toBe(4000);
    expect(result.DB_POOL_MAX).toBe(25);
  });

  it.each(['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'REDIS_URL'])(
    'throws when the required variable %s is missing',
    (key) => {
      const config = buildValidConfig();
      delete config[key];

      expect(() => validateEnv(config)).toThrow('Environment validation failed');
      expect(consoleErrorSpy).toHaveBeenCalled();
    },
  );

  it('rejects a JWT secret shorter than 32 characters', () => {
    expect(() => validateEnv(buildValidConfig({ JWT_ACCESS_SECRET: 'too-short' }))).toThrow(
      'Environment validation failed',
    );
  });

  it('rejects a malformed DATABASE_URL', () => {
    expect(() => validateEnv(buildValidConfig({ DATABASE_URL: 'not-a-url' }))).toThrow(
      'Environment validation failed',
    );
  });

  it('rejects an APP_VERSION that is not valid semver', () => {
    expect(() => validateEnv(buildValidConfig({ APP_VERSION: 'v1' }))).toThrow();
  });

  it('rejects an ALLOWED_ORIGINS entry that is not a URL or wildcard', () => {
    expect(() =>
      validateEnv(buildValidConfig({ ALLOWED_ORIGINS: 'https://ok.com,not-a-url' })),
    ).toThrow();
  });

  it('accepts a wildcard and multiple valid URLs in ALLOWED_ORIGINS', () => {
    const result = validateEnv(
      buildValidConfig({ ALLOWED_ORIGINS: 'https://a.com, https://b.com' }),
    );

    expect(result.ALLOWED_ORIGINS).toBe('https://a.com, https://b.com');
  });

  it('never echoes secret values in the thrown/logged error, only field names', () => {
    const config = buildValidConfig({ JWT_ACCESS_SECRET: 'my-leaked-secret' });

    expect(() => validateEnv(config)).toThrow();

    const loggedOutput = consoleErrorSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(loggedOutput).toContain('JWT_ACCESS_SECRET');
    expect(loggedOutput).not.toContain('super-secret-value-but-too-short');
  });

  describe('cross-field: STORAGE_PROVIDER=cloud', () => {
    it('requires the AWS credentials when set to cloud', () => {
      expect(() => validateEnv(buildValidConfig({ STORAGE_PROVIDER: 'cloud' }))).toThrow();
    });

    it('passes once every required AWS field is present', () => {
      const result = validateEnv(
        buildValidConfig({
          STORAGE_PROVIDER: 'cloud',
          STORAGE_AWS_ACCESS_KEY_ID: 'AKIA...',
          STORAGE_AWS_SECRET_ACCESS_KEY: 'secret',
          STORAGE_AWS_BUCKET_NAME: 'my-bucket',
        }),
      );

      expect(result.STORAGE_PROVIDER).toBe('cloud');
    });

    it('does not require AWS credentials for the default local provider', () => {
      expect(() => validateEnv(buildValidConfig())).not.toThrow();
    });
  });

  describe('cross-field: MAIL_PROVIDER=smtp', () => {
    it('requires all SMTP_* fields when set to smtp', () => {
      expect(() => validateEnv(buildValidConfig({ MAIL_PROVIDER: 'smtp' }))).toThrow();
    });

    it('passes once every required SMTP field is present', () => {
      const result = validateEnv(
        buildValidConfig({
          MAIL_PROVIDER: 'smtp',
          SMTP_HOST: 'smtp.example.com',
          SMTP_PORT: '587',
          SMTP_USER: 'apikey',
          SMTP_PASSWORD: 'secret',
        }),
      );

      expect(result.MAIL_PROVIDER).toBe('smtp');
    });

    it('treats an empty-string SMTP_HOST as absent, not a blank override', () => {
      expect(() =>
        validateEnv(
          buildValidConfig({
            MAIL_PROVIDER: 'smtp',
            SMTP_HOST: '',
            SMTP_PORT: '587',
            SMTP_USER: 'apikey',
            SMTP_PASSWORD: 'secret',
          }),
        ),
      ).toThrow();
    });
  });

  it('falls back to the safe default MIME allow-list when left blank', () => {
    const result = validateEnv(buildValidConfig({ STORAGE_ALLOWED_MIME_TYPES: '' }));

    expect(result.STORAGE_ALLOWED_MIME_TYPES).toBe(
      'image/jpeg,image/png,image/webp,image/gif,application/pdf',
    );
  });

  it('parses DB_SSL "true"/"false" strings into real booleans', () => {
    expect(validateEnv(buildValidConfig({ DB_SSL: 'true' })).DB_SSL).toBe(true);
    expect(validateEnv(buildValidConfig({ DB_SSL: 'false' })).DB_SSL).toBe(false);
    expect(validateEnv(buildValidConfig()).DB_SSL).toBeUndefined();
  });
});
