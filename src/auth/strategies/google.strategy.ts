import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { GoogleProfile } from '../interfaces/auth.interfaces';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly isConfigured: boolean;

  constructor(configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID') ?? '';
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET') ?? '';
    const callbackURL =
      configService.get<string>('GOOGLE_CALLBACK_URL') ??
      'http://localhost:3006/api/v1/auth/google/callback';

    // Passport-OAuth2 requires non-empty clientID/clientSecret at construction time.
    // When credentials are absent we pass sentinels so the app starts; validate()
    // guards against actual use and returns a clean error instead.
    super({
      clientID: clientID || 'google-not-configured',
      clientSecret: clientSecret || 'google-not-configured',
      callbackURL,
      scope: ['email', 'profile'],
    });

    this.isConfigured = !!(clientID && clientSecret);
  }

  validate(
    accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    if (!this.isConfigured) {
      return done(
        new Error(
          'Google OAuth is not configured on this server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
        ),
        false,
      );
    }

    const email = profile.emails?.[0]?.value;
    if (!email) {
      return done(new Error('No email address returned from Google OAuth'), false);
    }

    const googleProfile: GoogleProfile = {
      googleId: profile.id,
      email,
      name: profile.displayName ?? null,
      accessToken,
    };

    done(null, googleProfile);
  }
}
