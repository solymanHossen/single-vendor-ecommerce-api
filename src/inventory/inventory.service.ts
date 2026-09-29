import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { variantLabel } from '../carts/cart-pricing';
import {
  MAX_IMPORT_ROWS,
  MAX_STOCK,
  MOVEMENT_LABEL,
  SALES_WINDOW_DAYS,
  TARGET_COVER_DAYS,
} from './inventory.constants';
import { InsufficientStockError, StockLedgerService, type StockUnit } from './stock-ledger.service';
import { parseCsv, toCsv } from './csv';
import type {
  AdjustStockDto,
  ImportStockDto,
  InventoryQueryDto,
  MovementQueryDto,
  StockAlertDto,
} from './dto/inventory.dto';
import {
  ImportResultEntity,
  ImportRowEntity,
  InventoryPageEntity,
  InventorySummaryEntity,
  InventoryUnitEntity,
  StockMovementEntity,
  StockMovementPageEntity,
  type StockLevelName,
} from './entities/inventory.entity';

interface UnitRow {
  product_id: number;
  variant_id: number | null;
  name: string;
  variant_label: string | null;
  sku: string;
  category: string;
  image_url: string | null;
  is_published: boolean;
  on_hand: number;
  threshold: number;
  custom_threshold: boolean;
  level: StockLevelName;
  sold: number;
  waiting: number;
  price: Prisma.Decimal;
}

const DAY = 86_400_000;

const SORT_SQL: Record<InventoryQueryDto['sort'], Prisma.Sql> = {
  // Out first, then low, then soonest to run out.
  attention: Prisma.sql`CASE level WHEN 'out' THEN 0 WHEN 'low' THEN 1 ELSE 2 END,
    CASE WHEN sold > 0 THEN on_hand::float / sold ELSE NULL END ASC NULLS LAST, name, sku`,
  stock_asc: Prisma.sql`on_hand ASC, name, sku`,
  stock_desc: Prisma.sql`on_hand DESC, name, sku`,
  sold_desc: Prisma.sql`sold DESC, name, sku`,
  name: Prisma.sql`name, sku`,
};

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedgerService,
    private readonly settings: SettingsService,
  ) {}

  // ── Inventory list ────────────────────────────────────────────────────────

  async list(query: InventoryQueryDto, now = new Date()): Promise<InventoryPageEntity> {
    const { lowStockThreshold } = await this.settings.getSettings();
    const units = this.unitsSql(lowStockThreshold, now);

    const filters: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (query.level !== 'all') filters.push(Prisma.sql`level = ${query.level}`);
    if (query.search) {
      const pattern = `%${query.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      filters.push(
        Prisma.sql`(name ILIKE ${pattern} OR sku ILIKE ${pattern} OR COALESCE(variant_label, '') ILIKE ${pattern})`,
      );
    }
    const where = Prisma.join(filters, ' AND ');

    const [rows, counted, totals] = await Promise.all([
      this.prisma.$queryRaw<UnitRow[]>`
        ${units} SELECT * FROM enriched WHERE ${where}
        ORDER BY ${SORT_SQL[query.sort]}
        LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
      this.prisma.$queryRaw<
        Array<{ n: number }>
      >`${units} SELECT COUNT(*)::int AS n FROM enriched WHERE ${where}`,
      this.prisma.$queryRaw<
        Array<{
          skus: number;
          units: number;
          out: number;
          low: number;
          ok: number;
          value: Prisma.Decimal | null;
          sold: number;
          waiting: number;
        }>
      >`
        ${units} SELECT COUNT(*)::int AS skus, COALESCE(SUM(on_hand), 0)::int AS units,
          COUNT(*) FILTER (WHERE level = 'out')::int AS out,
          COUNT(*) FILTER (WHERE level = 'low')::int AS low,
          COUNT(*) FILTER (WHERE level = 'ok')::int AS ok,
          SUM(on_hand * price) AS value,
          COALESCE(SUM(sold), 0)::int AS sold,
          COALESCE(SUM(waiting), 0)::int AS waiting
        FROM enriched`,
    ]);
    const total = counted[0]?.n ?? 0;
    const sum = totals[0];

    return new InventoryPageEntity({
      items: rows.map((row) => this.toUnit(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      },
      summary: new InventorySummaryEntity({
        skus: sum?.skus ?? 0,
        units: sum?.units ?? 0,
        out: sum?.out ?? 0,
        low: sum?.low ?? 0,
        ok: sum?.ok ?? 0,
        retailValue: new Prisma.Decimal(sum?.value ?? 0).toFixed(0),
        sold30d: sum?.sold ?? 0,
        waiting: sum?.waiting ?? 0,
        storeThreshold: lowStockThreshold,
      }),
    });
  }

  /** Low and out-of-stock published units, most urgent first — the daily digest. */
  async attentionUnits(limit: number): Promise<InventoryUnitEntity[]> {
    const { lowStockThreshold } = await this.settings.getSettings();
    const rows = await this.prisma.$queryRaw<UnitRow[]>`
      ${this.unitsSql(lowStockThreshold, new Date())}
      SELECT * FROM enriched WHERE level <> 'ok' AND is_published
      ORDER BY ${SORT_SQL.attention} LIMIT ${limit}`;
    return rows.map((row) => this.toUnit(row));
  }

  // ── Adjustments ───────────────────────────────────────────────────────────

  async adjust(dto: AdjustStockDto, actorId: number): Promise<InventoryUnitEntity> {
    const unit = await this.resolveUnit(dto.productId, dto.variantId);
    const type = dto.type as StockMovementType;
    const note = dto.note || null;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (dto.type === 'RECOUNT') {
          await this.ledger.set(tx, unit, dto.quantity, { type, note, actorId });
          return;
        }
        const delta =
          dto.type === 'RECEIVED'
            ? dto.quantity
            : dto.type === 'CORRECTION'
              ? dto.quantity
              : -dto.quantity;
        await this.ledger.apply(tx, [{ ...unit, delta, type, note, actorId }]);
      });
    } catch (error: unknown) {
      if (error instanceof InsufficientStockError) {
        const current = await this.onHand(unit);
        throw new BadRequestException(
          `Only ${current} in stock — you can't take away ${Math.abs(dto.quantity)}.`,
        );
      }
      throw error;
    }

    return this.unit(unit);
  }

  // ── History ───────────────────────────────────────────────────────────────

  async movements(query: MovementQueryDto): Promise<StockMovementPageEntity> {
    const where: Prisma.StockMovementWhereInput = {
      ...(query.productId && { productId: query.productId }),
      ...(query.variantId && { variantId: query.variantId }),
      ...(query.type && { type: query.type }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          productId: true,
          variantId: true,
          type: true,
          quantity: true,
          balanceAfter: true,
          note: true,
          orderId: true,
          createdAt: true,
          product: { select: { name: true, sku: true } },
          variant: {
            select: {
              sku: true,
              options: {
                select: { attributeOption: { select: { value: true } } },
                orderBy: { id: 'asc' },
              },
            },
          },
          actor: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return new StockMovementPageEntity({
      items: rows.map(
        (row) =>
          new StockMovementEntity({
            id: row.id,
            productId: row.productId,
            variantId: row.variantId,
            productName: row.product.name,
            variantLabel: row.variant
              ? variantLabel(row.variant.options.map((option) => option.attributeOption))
              : null,
            sku: row.variant?.sku ?? row.product.sku,
            type: row.type,
            label: MOVEMENT_LABEL[row.type],
            quantity: row.quantity,
            balanceAfter: row.balanceAfter,
            note: row.note,
            orderId: row.orderId,
            actor: row.actor,
            createdAt: row.createdAt,
          }),
      ),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      },
    });
  }

  // ── CSV ───────────────────────────────────────────────────────────────────

  async exportCsv(): Promise<string> {
    const { lowStockThreshold } = await this.settings.getSettings();
    const rows = await this.prisma.$queryRaw<UnitRow[]>`
      ${this.unitsSql(lowStockThreshold, new Date())} SELECT * FROM enriched ORDER BY name, sku`;
    return toCsv([
      ['sku', 'product', 'variant', 'on_hand', 'low_stock_threshold', 'sold_30d', 'status'],
      ...rows.map((row) => [
        row.sku,
        row.name,
        row.variant_label ?? '',
        String(row.on_hand),
        String(row.threshold),
        String(row.sold),
        row.level,
      ]),
    ]);
  }

  /**
   * Sets counts from a CSV (sku + on_hand). A dry run previews every row;
   * applying requires an error-free file and writes one IMPORT movement per
   * change, all in one transaction.
   */
  async importCsv(dto: ImportStockDto, actorId: number): Promise<ImportResultEntity> {
    const table = parseCsv(dto.csv);
    const header = (table[0] ?? []).map((cell) => cell.trim().toLowerCase());
    const skuCol = header.indexOf('sku');
    const qtyCol = header.findIndex(
      (cell) => cell === 'on_hand' || cell === 'quantity' || cell === 'stock',
    );
    if (skuCol === -1 || qtyCol === -1) {
      throw new BadRequestException(
        'The first row must name the columns, including "sku" and "on_hand".',
      );
    }
    const body = table.slice(1).filter((row) => row.some((cell) => cell.trim() !== ''));
    if (body.length === 0) throw new BadRequestException('The file has no rows to import.');
    if (body.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(`Import at most ${MAX_IMPORT_ROWS} rows at a time.`);
    }

    const skus = body.map((row) => (row[skuCol] ?? '').trim());
    const [variants, products] = await Promise.all([
      this.prisma.productVariant.findMany({
        where: { sku: { in: skus } },
        select: {
          id: true,
          sku: true,
          productId: true,
          stockQuantity: true,
          product: { select: { name: true } },
        },
      }),
      this.prisma.product.findMany({
        where: { sku: { in: skus } },
        select: {
          id: true,
          sku: true,
          name: true,
          stockQuantity: true,
          _count: { select: { variants: true } },
        },
      }),
    ]);
    const variantBySku = new Map(variants.map((v) => [v.sku, v]));
    const productBySku = new Map(products.map((p) => [p.sku, p]));

    const seen = new Set<string>();
    const planned: Array<{ unit: StockUnit; count: number }> = [];
    const rows = body.map((row, index) => {
      const line = index + 2;
      const sku = (row[skuCol] ?? '').trim();
      const raw = (row[qtyCol] ?? '').trim();
      const fail = (error: string, name: string | null = null, current: number | null = null) =>
        new ImportRowEntity({ line, sku, name, current, next: null, error });

      if (!sku) return fail('Missing SKU');
      if (seen.has(sku)) return fail('This SKU appears more than once');
      seen.add(sku);
      const count = Number(raw);
      if (raw === '' || !Number.isInteger(count) || count < 0 || count > MAX_STOCK) {
        return fail(`Stock must be a whole number from 0 to ${MAX_STOCK.toLocaleString('en-US')}`);
      }
      const variant = variantBySku.get(sku);
      if (variant) {
        planned.push({ unit: { productId: variant.productId, variantId: variant.id }, count });
        return new ImportRowEntity({
          line,
          sku,
          name: variant.product.name,
          current: variant.stockQuantity,
          next: count,
          error: null,
        });
      }
      const product = productBySku.get(sku);
      if (!product) return fail('No product or variant has this SKU');
      if (product._count.variants > 0) {
        return fail(
          'Stock is kept per variant — use the variant SKUs',
          product.name,
          product.stockQuantity,
        );
      }
      planned.push({ unit: { productId: product.id, variantId: null }, count });
      return new ImportRowEntity({
        line,
        sku,
        name: product.name,
        current: product.stockQuantity,
        next: count,
        error: null,
      });
    });

    const errors = rows.filter((row) => row.error !== null).length;
    const changed = rows.filter((row) => row.error === null && row.current !== row.next).length;
    const unchanged = rows.length - errors - changed;
    const applying = !dto.dryRun;
    if (applying && errors > 0) {
      throw new ConflictException(
        `Fix the ${errors} highlighted ${errors === 1 ? 'row' : 'rows'} before importing.`,
      );
    }
    if (applying) {
      await this.prisma.$transaction(
        async (tx) => {
          for (const { unit, count } of planned) {
            await this.ledger.set(tx, unit, count, {
              type: StockMovementType.IMPORT,
              actorId,
              note: 'CSV import',
            });
          }
        },
        { timeout: 60_000 },
      );
    }
    return new ImportResultEntity({ applied: applying, changed, unchanged, errors, rows });
  }

  // ── Back in stock ─────────────────────────────────────────────────────────

  /** A shopper asks to be emailed when an out-of-stock item returns. */
  async subscribe(
    productId: number,
    dto: StockAlertDto,
    userId: number | null,
  ): Promise<{ subscribed: true }> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isPublished: true },
      select: { stockQuantity: true, _count: { select: { variants: true } } },
    });
    if (!product) throw new NotFoundException('Product not found.');
    if (product._count.variants > 0 && dto.variantId === null) {
      throw new BadRequestException('Choose the option you want first.');
    }
    const unit = await this.resolveUnit(productId, dto.variantId);
    const onHand = await this.onHand(unit);
    if (onHand > 0)
      throw new ConflictException('Good news — it’s in stock now. Add it to your cart.');

    const unitKey = `${productId}:${dto.variantId ?? 0}`;
    await this.prisma.stockAlert.upsert({
      where: { email_unitKey: { email: dto.email, unitKey } },
      create: { email: dto.email, userId, productId, variantId: dto.variantId, unitKey },
      update: { notifiedAt: null, ...(userId && { userId }) },
      select: { id: true },
    });
    return { subscribed: true };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Every sellable unit (simple products + variants) with its threshold,
   * level, 30-day sales and waiting shoppers. Ends with `enriched`; callers
   * append a SELECT.
   */
  private unitsSql(storeThreshold: number, now: Date): Prisma.Sql {
    const since = new Date(now.getTime() - SALES_WINDOW_DAYS * DAY);
    return Prisma.sql`
      WITH sold AS (
        SELECT oi.product_id, oi.variant_id, SUM(oi.quantity)::int AS units
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.created_at >= ${since} AND o.status <> 'CANCELLED'
        GROUP BY oi.product_id, oi.variant_id
      ),
      waiting AS (
        SELECT product_id, variant_id, COUNT(*)::int AS n
        FROM stock_alerts WHERE notified_at IS NULL
        GROUP BY product_id, variant_id
      ),
      units AS (
        SELECT p.id AS product_id, NULL::int AS variant_id, p.name, NULL::text AS variant_label, p.sku,
               c.name AS category, p.is_published, p.stock_quantity AS on_hand,
               COALESCE(p.low_stock_threshold, ${storeThreshold}) AS threshold,
               (p.low_stock_threshold IS NOT NULL) AS custom_threshold,
               COALESCE(p.discount_price, p.base_price) AS price,
               (SELECT i.url FROM product_images i WHERE i.product_id = p.id
                 ORDER BY i.is_thumbnail DESC, i.id LIMIT 1) AS image_url
        FROM products p JOIN categories c ON c.id = p.category_id
        WHERE NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id)
        UNION ALL
        SELECT p.id, v.id, p.name,
               (SELECT string_agg(ao.value, ' · ' ORDER BY vo.id)
                  FROM variant_options vo JOIN attribute_options ao ON ao.id = vo.attribute_option_id
                 WHERE vo.variant_id = v.id),
               v.sku, c.name, p.is_published, v.stock_quantity,
               COALESCE(p.low_stock_threshold, ${storeThreshold}),
               (p.low_stock_threshold IS NOT NULL),
               v.price,
               COALESCE(v.image_url, (SELECT i.url FROM product_images i WHERE i.product_id = p.id
                 ORDER BY i.is_thumbnail DESC, i.id LIMIT 1))
        FROM product_variants v JOIN products p ON p.id = v.product_id JOIN categories c ON c.id = p.category_id
      ),
      enriched AS (
        SELECT u.*, COALESCE(s.units, 0) AS sold, COALESCE(w.n, 0) AS waiting,
          CASE WHEN u.on_hand = 0 THEN 'out' WHEN u.on_hand <= u.threshold THEN 'low' ELSE 'ok' END AS level
        FROM units u
        LEFT JOIN sold s ON s.product_id = u.product_id AND s.variant_id IS NOT DISTINCT FROM u.variant_id
        LEFT JOIN waiting w ON w.product_id = u.product_id AND w.variant_id IS NOT DISTINCT FROM u.variant_id
      )`;
  }

  private toUnit(row: UnitRow): InventoryUnitEntity {
    const perDay = row.sold / SALES_WINDOW_DAYS;
    return new InventoryUnitEntity({
      productId: row.product_id,
      variantId: row.variant_id,
      name: row.name,
      variantLabel: row.variant_label,
      sku: row.sku,
      category: row.category,
      imageUrl: row.image_url,
      isPublished: row.is_published,
      onHand: row.on_hand,
      threshold: row.threshold,
      customThreshold: row.custom_threshold,
      level: row.level,
      sold30d: row.sold,
      daysOfCover: perDay > 0 ? Math.floor(row.on_hand / perDay) : null,
      // Enough for TARGET_COVER_DAYS of sales, plus the safety threshold.
      reorderSuggestion:
        perDay > 0
          ? Math.max(0, Math.ceil(perDay * TARGET_COVER_DAYS) + row.threshold - row.on_hand)
          : null,
      waiting: row.waiting,
      price: new Prisma.Decimal(row.price).toString(),
    });
  }

  private async unit(unit: StockUnit): Promise<InventoryUnitEntity> {
    const { lowStockThreshold } = await this.settings.getSettings();
    const rows = await this.prisma.$queryRaw<UnitRow[]>`
      ${this.unitsSql(lowStockThreshold, new Date())}
      SELECT * FROM enriched WHERE product_id = ${unit.productId}
        AND variant_id IS NOT DISTINCT FROM ${unit.variantId}::int`;
    const row = rows[0];
    if (!row) throw new NotFoundException('That product or variant no longer exists.');
    return this.toUnit(row);
  }

  /** A unit that exists and is the right shape (variant products need a variant). */
  private async resolveUnit(productId: number, variantId: number | null): Promise<StockUnit> {
    if (variantId !== null) {
      const variant = await this.prisma.productVariant.findFirst({
        where: { id: variantId, productId },
        select: { id: true },
      });
      if (!variant) throw new NotFoundException('That variant does not belong to this product.');
      return { productId, variantId };
    }
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { _count: { select: { variants: true } } },
    });
    if (!product) throw new NotFoundException('Product not found.');
    if (product._count.variants > 0) {
      throw new BadRequestException('This product keeps stock per variant — choose a variant.');
    }
    return { productId, variantId: null };
  }

  private async onHand(unit: StockUnit): Promise<number> {
    const row =
      unit.variantId === null
        ? await this.prisma.product.findUnique({
            where: { id: unit.productId },
            select: { stockQuantity: true },
          })
        : await this.prisma.productVariant.findUnique({
            where: { id: unit.variantId },
            select: { stockQuantity: true },
          });
    return row?.stockQuantity ?? 0;
  }
}
