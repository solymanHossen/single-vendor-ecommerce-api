import type { ConfigService } from '@nestjs/config';
import type { Profile, VerifyCallback } from 'passport-google-oauth20';
import { GoogleStrategy } from './google.strategy';

function buildConfigService(values: Record<string, string | undefined>): ConfigService {
  return { get: jest.fn((key: string) => values[key]) } as unknown as ConfigService;
}

function buildProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'google-123',
    displayName: 'Jane Doe',
    emails: [{ value: 'jane@example.com', verified: true }],
    ...overrides,
  } as unknown as Profile;
}

describe('GoogleStrategy', () => {
  describe('when GOOGLE_CLIENT_ID/SECRET are configured', () => {
    let strategy: GoogleStrategy;

    beforeEach(() => {
      strategy = new GoogleStrategy(
        buildConfigService({
          GOOGLE_CLIENT_ID: 'client-id',
          GOOGLE_CLIENT_SECRET: 'client-secret',
        }),
      );
    });

    it('maps a Google profile into a GoogleProfile and calls done(null, profile)', () => {
      const done = jest.fn() as unknown as VerifyCallback;

      strategy.validate('access-token', 'refresh-token', buildProfile(), done);

      expect(done).toHaveBeenCalledWith(null, {
        googleId: 'google-123',
        email: 'jane@example.com',
        name: 'Jane Doe',
        accessToken: 'access-token',
      });
    });

    it('falls back to a null name when displayName is absent', () => {
      const done = jest.fn() as unknown as VerifyCallback;

      strategy.validate(
        'access-token',
        'refresh-token',
        buildProfile({ displayName: undefined }),
        done,
      );

      expect(done).toHaveBeenCalledWith(null, expect.objectContaining({ name: null }));
    });

    it('rejects with an error when Google returns no email address', () => {
      const done = jest.fn() as unknown as VerifyCallback;

      strategy.validate('access-token', 'refresh-token', buildProfile({ emails: [] }), done);

      expect(done).toHaveBeenCalledWith(expect.any(Error), false);
    });
  });

  describe('when GOOGLE_CLIENT_ID/SECRET are not configured', () => {
    it('rejects validate() with a clear configuration error instead of throwing at construction', () => {
      const strategy = new GoogleStrategy(buildConfigService({}));
      const done = jest.fn() as unknown as VerifyCallback;

      strategy.validate('access-token', 'refresh-token', buildProfile(), done);

      expect(done).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('not configured') }),
        false,
      );
    });
  });
});
