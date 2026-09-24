import { Module } from '@nestjs/common';
import { StorefrontController } from './storefront.controller';
import { StorefrontService } from './storefront.service';
import { StorefrontCatalogService } from './storefront-catalog.service';

@Module({
  controllers: [StorefrontController],
  providers: [StorefrontService, StorefrontCatalogService],
  exports: [StorefrontService, StorefrontCatalogService],
})
export class StorefrontModule {}
