import { Global, Module } from '@nestjs/common';
import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { CorrelationIdStore } from './correlation-id.store';
import { EnterpriseLoggerService } from './enterprise-logger.service';

@Global()
@Module({
  providers: [CorrelationIdStore, CorrelationIdMiddleware, EnterpriseLoggerService],
  exports: [CorrelationIdStore, CorrelationIdMiddleware, EnterpriseLoggerService],
})
export class LoggerModule {}
