import { Module } from '@nestjs/common';
import { CartsModule } from '../carts/carts.module';
import { CouponsModule } from '../coupons/coupons.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [CartsModule, CouponsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
