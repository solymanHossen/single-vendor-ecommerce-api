import { ApiProperty } from '@nestjs/swagger';
import type { StockMovementType } from '@prisma/client';

export type StockLevelName = 'out' | 'low' | 'ok';

/** One sellable stock unit: a simple product or one variant. */
export class InventoryUnitEntity {
  @ApiProperty() productId!: number;
  @ApiProperty({ nullable: true }) variantId!: number | null;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, example: 'Black · 128GB' }) variantLabel!: string | null;
  @ApiProperty() sku!: string;
  @ApiProperty() category!: string;
  @ApiProperty({ nullable: true }) imageUrl!: string | null;
  @ApiProperty() isPublished!: boolean;
  @ApiProperty() onHand!: number;
  @ApiProperty({ description: 'Low-stock threshold in force (product override or store default)' })
  threshold!: number;
  @ApiProperty({ description: 'Product has its own threshold' }) customThreshold!: boolean;
  @ApiProperty({ enum: ['out', 'low', 'ok'] }) level!: StockLevelName;
  @ApiProperty({ description: 'Units sold in the last 30 days (not cancelled)' }) sold30d!: number;
  @ApiProperty({
    nullable: true,
    example: 12,
    description: 'Days until it runs out at the current pace',
  })
  daysOfCover!: number | null;
  @ApiProperty({ nullable: true, example: 40, description: 'Units to order for ~30 days of cover' })
  reorderSuggestion!: number | null;
  @ApiProperty({ description: 'Shoppers waiting for a back-in-stock email' }) waiting!: number;
  @ApiProperty({ type: String, description: 'Selling price, for stock value' }) price!: string;

  constructor(partial: InventoryUnitEntity) {
    Object.assign(this, partial);
  }
}

export class InventorySummaryEntity {
  @ApiProperty() units!: number;
  @ApiProperty({ description: 'Stock units (products + variants)' }) skus!: number;
  @ApiProperty() out!: number;
  @ApiProperty() low!: number;
  @ApiProperty() ok!: number;
  @ApiProperty({ type: String, description: 'On hand × selling price' }) retailValue!: string;
  @ApiProperty() sold30d!: number;
  @ApiProperty() waiting!: number;
  @ApiProperty() storeThreshold!: number;

  constructor(partial: InventorySummaryEntity) {
    Object.assign(this, partial);
  }
}

export class InventoryPageEntity {
  @ApiProperty({ type: () => InventoryUnitEntity, isArray: true }) items!: InventoryUnitEntity[];
  @ApiProperty() meta!: { page: number; limit: number; total: number; totalPages: number };
  @ApiProperty({ type: () => InventorySummaryEntity }) summary!: InventorySummaryEntity;

  constructor(partial: InventoryPageEntity) {
    Object.assign(this, partial);
  }
}

export class StockMovementEntity {
  @ApiProperty() id!: number;
  @ApiProperty() productId!: number;
  @ApiProperty({ nullable: true }) variantId!: number | null;
  @ApiProperty() productName!: string;
  @ApiProperty({ nullable: true }) variantLabel!: string | null;
  @ApiProperty() sku!: string;
  @ApiProperty() type!: StockMovementType;
  @ApiProperty({ example: 'Received' }) label!: string;
  @ApiProperty({ example: -2 }) quantity!: number;
  @ApiProperty() balanceAfter!: number;
  @ApiProperty({ nullable: true }) note!: string | null;
  @ApiProperty({ nullable: true }) orderId!: number | null;
  @ApiProperty({ nullable: true }) actor!: {
    id: number;
    name: string | null;
    email: string;
  } | null;
  @ApiProperty() createdAt!: Date;

  constructor(partial: StockMovementEntity) {
    Object.assign(this, partial);
  }
}

export class StockMovementPageEntity {
  @ApiProperty({ type: () => StockMovementEntity, isArray: true }) items!: StockMovementEntity[];
  @ApiProperty() meta!: { page: number; limit: number; total: number; totalPages: number };

  constructor(partial: StockMovementPageEntity) {
    Object.assign(this, partial);
  }
}

export class ImportRowEntity {
  @ApiProperty() line!: number;
  @ApiProperty() sku!: string;
  @ApiProperty({ nullable: true }) name!: string | null;
  @ApiProperty({ nullable: true }) current!: number | null;
  @ApiProperty({ nullable: true }) next!: number | null;
  @ApiProperty({ nullable: true }) error!: string | null;

  constructor(partial: ImportRowEntity) {
    Object.assign(this, partial);
  }
}

export class ImportResultEntity {
  @ApiProperty() applied!: boolean;
  @ApiProperty() changed!: number;
  @ApiProperty() unchanged!: number;
  @ApiProperty() errors!: number;
  @ApiProperty({ type: () => ImportRowEntity, isArray: true }) rows!: ImportRowEntity[];

  constructor(partial: ImportResultEntity) {
    Object.assign(this, partial);
  }
}
