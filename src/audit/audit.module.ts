import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditRetentionTask } from './audit-retention.task';

/** Global so any module can record an event without importing this one. */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditRetentionTask],
  exports: [AuditService],
})
export class AuditModule {}
