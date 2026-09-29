import { Module } from '@nestjs/common';
import { PagesService } from './pages.service';
import { PagesController, AdminPagesController } from './pages.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [PagesController, AdminPagesController],
  providers: [PagesService],
})
export class PagesModule {}
