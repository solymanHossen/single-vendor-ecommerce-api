import { Global, Module } from '@nestjs/common';
import { StockLedgerService } from './stock-ledger.service';

/** Global: orders, products, variants and returns all change stock through it. */
@Global()
@Module({
  providers: [StockLedgerService],
  exports: [StockLedgerService],
})
export class StockLedgerModule {}
