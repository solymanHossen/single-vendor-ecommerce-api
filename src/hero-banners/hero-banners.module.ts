import { Module } from '@nestjs/common';
import { HeroBannersController } from './hero-banners.controller';
import { HeroBannersService } from './hero-banners.service';

@Module({
  controllers: [HeroBannersController],
  providers: [HeroBannersService],
  exports: [HeroBannersService],
})
export class HeroBannersModule {}
