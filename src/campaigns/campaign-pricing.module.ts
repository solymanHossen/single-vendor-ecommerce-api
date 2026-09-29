import { Global, Module } from '@nestjs/common';
import { CampaignPricingService } from './campaign-pricing.service';

/** Global so cart, orders, storefront and wishlist price through one place. */
@Global()
@Module({
  providers: [CampaignPricingService],
  exports: [CampaignPricingService],
})
export class CampaignPricingModule {}
