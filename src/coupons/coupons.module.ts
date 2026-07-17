import { Module } from '@nestjs/common';
import { CartsModule } from '../carts/carts.module';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';

@Module({
  imports: [CartsModule],
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
