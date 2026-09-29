import { Module } from '@nestjs/common';
import { StorefrontModule } from '../storefront/storefront.module';
import { AdminCampaignsController, StorefrontCampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

@Module({
  imports: [StorefrontModule],
  controllers: [StorefrontCampaignsController, AdminCampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
