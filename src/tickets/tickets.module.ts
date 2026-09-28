import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { AdminTicketsController } from './admin-tickets.controller';
import { AdminTicketsService } from './admin-tickets.service';
import { TicketAutoCloseTask } from './ticket-auto-close.task';

@Module({
  controllers: [TicketsController, AdminTicketsController],
  providers: [TicketsService, AdminTicketsService, TicketAutoCloseTask],
  exports: [TicketsService, AdminTicketsService],
})
export class TicketsModule {}
