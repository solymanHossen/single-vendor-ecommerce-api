import { Global, Module } from '@nestjs/common';
import { AppIdentityService } from './app-identity.service';

@Global()
@Module({
  providers: [AppIdentityService],
  exports: [AppIdentityService],
})
export class AppIdentityModule {}
