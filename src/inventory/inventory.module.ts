import { Module } from '@nestjs/common';
import { AdminInventoryController, StockAlertsController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryTasks } from './inventory.tasks';

@Module({
  controllers: [AdminInventoryController, StockAlertsController],
  providers: [InventoryService, InventoryTasks],
  exports: [InventoryService],
})
export class InventoryModule {}
