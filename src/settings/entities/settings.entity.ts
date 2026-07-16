import { ApiProperty } from '@nestjs/swagger';

export class SettingsEntity {
  @ApiProperty({
    example: true,
    description: 'Whether new local (email/password) account registration is permitted',
  })
  allowRegistration: boolean;

  @ApiProperty({
    example: true,
    description: 'Whether Google OAuth login/sign-up is permitted',
  })
  enableGoogleLogin: boolean;

  constructor(partial: SettingsEntity) {
    this.allowRegistration = partial.allowRegistration;
    this.enableGoogleLogin = partial.enableGoogleLogin;
  }
}
