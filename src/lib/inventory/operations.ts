import {
  inventoryDefaultUnit,
  registerInventoryUnit,
  nextInventoryDate,
  validateInventoryUnit,
  type InventoryItem,
  type InventoryRecords,
} from "./model.ts";
import { workGoods } from "../work/goods.ts";
export interface CatalogGood {
  id: string;
  name: string;
  category: string;
  detail?: string;
  location?: string;
  baseUnit: string;
}
export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
}
export interface SupplierOffer {
  id: string;
  itemId: string;
  supplierId: string;
  supplierName: string;
  supplierItemName: string;
  sku: string;
  packSize: number;
  packUnit: string;
  orderUnit: string;
  preferred: boolean;
}
export interface PurchaseLine {
  itemId: string;
  name: string;
  supplierItemName: string;
  sku: string;
  quantity: number;
  unit: string;
  packSize: number;
  packUnit: string;
  receivedQuantity: number;
}
export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  status: "ordered" | "received" | "partial";
  orderedAt: string;
  orderedBy: string;
  lines: PurchaseLine[];
}
export interface InvoiceLine {
  sku?: string; createCatalog?: boolean; catalogName?: string; catalogCategory?: string;
  itemId?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}
export interface Invoice {
  id: string;
  version: number;
  supplierId: string;
  supplierName: string;
  number: string;
  date: string;
  total: number;
  orderId?: string;
  attachmentId?: string;
  rawText?: string;
  status: "draft" | "reviewed";
  lines: InvoiceLine[];
  createdAt: string;
  updatedAt: string;
}
export interface ReceiptLine {
  unit?: string;
  itemId: string;
  orderedQuantity: number;
  receivedQuantity: number;
  damagedQuantity: number;
  note: string;
  stockNote?: string;
}
export interface Receipt {
  supplierId?: string; supplierName?: string;
  id: string;
  orderId: string;
  at: string;
  by: string;
  lines: ReceiptLine[];
  note?: string;
}
export interface Activity {
  id: string;
  action: string;
  at: string;
  actor: string;
  by: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
}
export interface OperationsBoard {
  activityHasMore?: boolean;
  activeOrdersTruncated?: boolean;
  historyRestart?: boolean;
  historyHasMore?: boolean;
  goods: CatalogGood[];
  suppliers: Supplier[];
  offers: SupplierOffer[];
  orders: PurchaseOrder[];
  invoices: Invoice[];
  receipts: Receipt[];
  events: Activity[];
  stock: InventoryRecords;
  today: string;
  timezone: string;
  customUnits: string[];
}
export const catalogGoods = (): CatalogGood[] =>
  workGoods.map((g) => ({ ...g, baseUnit: inventoryDefaultUnit(g.detail) }));
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Enter valid details");
  return value as Record<string, unknown>;
}
export function identifier(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(value) ||
    ["__proto__", "constructor", "prototype"].includes(value)
  )
    throw new Error("Choose a valid record");
  return value;
}
export function textValue(value: unknown, max = 160, required = true): string {
  if (typeof value !== "string") {
    if (!required && value === undefined) return "";
    throw new Error("Enter text");
  }
  const s = value.trim();
  if ((required && !s) || s.length > max)
    throw new Error(`Enter ${required ? "1–" : ""}${max} characters`);
  return s;
}
export function amount(value: unknown, positive = false, max = 999999): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < (positive ? 0.01 : 0) ||
    value > max ||
    Math.round(value * 100) / 100 !== value
  )
    throw new Error("Enter a valid amount with up to two decimals");
  return value;
}
export function supplierInput(value: unknown, id: string): Supplier {
  const v = object(value);
  return {
    id,
    name: textValue(v.name),
    phone: textValue(v.phone, 80, false),
    notes: textValue(v.notes, 1000, false),
  };
}
export function goodInput(value: unknown, id: string): CatalogGood {
  const v = object(value);
  return {
    id,
    name: textValue(v.name),
    category: textValue(v.category, 80),
    detail: textValue(v.detail, 300, false),
    location: textValue(v.location, 120, false),
    baseUnit: validateInventoryUnit(v.baseUnit),
  };
}
export function offerInput(
  value: unknown,
  id: string,
  goods: CatalogGood[],
  suppliers: Supplier[],
): SupplierOffer {
  const v = object(value),
    itemId = identifier(v.itemId),
    supplierId = identifier(v.supplierId),
    supplier = suppliers.find((s) => s.id === supplierId);
  if (!goods.some((g) => g.id === itemId) || !supplier)
    throw new Error("Choose an item and supplier");
  return {
    id,
    itemId,
    supplierId,
    supplierName: supplier.name,
    supplierItemName: textValue(v.supplierItemName),
    sku: textValue(v.sku, 100, false),
    packSize: amount(v.packSize, true),
    packUnit: validateInventoryUnit(v.packUnit),
    orderUnit: validateInventoryUnit(v.orderUnit),
    preferred: v.preferred === true,
  };
}
export function orderInput(
  value: unknown,
  id: string,
  goods: CatalogGood[],
  suppliers: Supplier[],
  offers: SupplierOffer[],
  at: string,
  by: string,
): PurchaseOrder {
  const v = object(value),
    supplier = suppliers.find((s) => s.id === identifier(v.supplierId));
  if (!supplier) throw new Error("Choose a supplier");
  if (!Array.isArray(v.lines) || !v.lines.length || v.lines.length > 150)
    throw new Error("Choose 1–150 order items");
  const seen = new Set<string>();
  const lines = v.lines.map((raw) => {
    const l = object(raw),
      offer = offers.find(
        (o) => o.id === identifier(l.offerId) && o.supplierId === supplier.id,
      );
    if (!offer || seen.has(offer.itemId))
      throw new Error("Choose each supplier item once");
    seen.add(offer.itemId);
    return {
      itemId: offer.itemId,
      name: goods.find((g) => g.id === offer.itemId)!.name,
      supplierItemName: offer.supplierItemName,
      sku: offer.sku,
      quantity: amount(l.quantity, true),
      unit: offer.orderUnit,
      packSize: offer.packSize,
      packUnit: offer.packUnit,
      receivedQuantity: 0,
    };
  });
  return {
    id,
    supplierId: supplier.id,
    supplierName: supplier.name,
    status: "ordered",
    orderedAt: at,
    orderedBy: by,
    lines,
  };
}
export function receiveInput(
  value: unknown,
  id: string,
  order: PurchaseOrder,
  stock: InventoryRecords,
  at: string,
  by: string,
): { order: PurchaseOrder; receipt: Receipt; stock: InventoryRecords } {
  const v = object(value);
  if (!Array.isArray(v.lines) || !v.lines.length || v.lines.length > 150)
    throw new Error("Enter received items");
  const seen = new Set<string>();
  let accepted = 0;
  const lines = v.lines.map((raw) => {
    const l = object(raw),
      itemId = identifier(l.itemId),
      ordered = order.lines.find((x) => x.itemId === itemId);
    if (!ordered || seen.has(itemId))
      throw new Error("Choose each ordered item once");
    seen.add(itemId);
    const receivedQuantity = amount(l.receivedQuantity),
      damagedQuantity = amount(l.damagedQuantity ?? 0);
    if (
      damagedQuantity > receivedQuantity ||
      Math.round((ordered.receivedQuantity + receivedQuantity) * 100) >
        Math.round(ordered.quantity * 100)
    )
      throw new Error(
        "Received quantity exceeds order, or damage exceeds delivery",
      );
    accepted += receivedQuantity;
    const stockNote = "Arrival recorded only. On-hand stock changes through a confirmed physical count.";
    return {
      itemId,
      orderedQuantity: ordered.quantity,
      unit: ordered.unit,
      receivedQuantity,
      damagedQuantity,
      note: textValue(l.note, 500, false),
      stockNote,
    };
  });
  if (!accepted) throw new Error("Enter at least one delivered quantity");
  const updated = order.lines.map((l) => ({
    ...l,
    receivedQuantity:
      Math.round(
        (l.receivedQuantity +
          (lines.find((x) => x.itemId === l.itemId)?.receivedQuantity || 0)) *
          100,
      ) / 100,
  }));
  return {
    order: {
      ...order,
      lines: updated,
      status: updated.every((l) => l.receivedQuantity === l.quantity)
        ? "received"
        : "partial",
    },
    receipt: {
      id,
      orderId: order.id,
      supplierId: order.supplierId,
      supplierName: order.supplierName,
      at,
      by,
      lines,
      note: textValue(v.note, 1000, false),
    },
    stock,
  };
}
export function countInput(
  value: unknown,
  previous: InventoryItem | undefined,
  today: string,
  at: string,
  by: string,
): InventoryItem {
  const v = object(value);
  if (!Number.isInteger(v.version) || v.version !== (previous?.version || 0))
    throw new Error(
      "This item changed on another device. Refresh before saving.",
    );
  return {
    ...previous,
    version: (previous?.version || 0) + 1,
    quantity: amount(v.quantity),
    unit: validateInventoryUnit(v.unit),
    countedAt: at,
    lastCountQuantity: amount(v.quantity),
    lastCountUnit: validateInventoryUnit(v.unit),
    stockSource: "count",
    stockUpdatedAt: at,
    updatedAt: at,
    checkedOn: today,
    checkedAt: at,
    checkedBy: by,
    decision: previous?.decision || "sufficient",
    nextCheck: nextInventoryDate(today),
    orderOpen: previous?.orderOpen || false,
    orderRequestedAt: previous?.orderRequestedAt || null,
  };
}
export function invoiceInput(
  value: unknown,
  id: string,
  previous: Invoice | undefined,
  suppliers: Supplier[],
  goods: CatalogGood[],
  orders: PurchaseOrder[],
  at: string,
): Invoice {
  const v = object(value);
  if (!Number.isInteger(v.version) || v.version !== (previous?.version || 0))
    throw new Error(
      "Invoice changed on another device. Refresh before saving.",
    );
  const supplier = suppliers.find((s) => s.id === identifier(v.supplierId));
  if (!supplier) throw new Error("Choose a supplier");
  const date = textValue(v.date, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date
  )
    throw new Error("Choose a valid invoice date");
  const orderId = v.orderId ? identifier(v.orderId) : undefined;
  if (
    orderId &&
    !orders.some((o) => o.id === orderId && o.supplierId === supplier.id)
  )
    throw new Error("Choose an order from this supplier");
  if (!Array.isArray(v.lines) || v.lines.length > 150)
    throw new Error("Enter up to 150 invoice lines");
  const lines = v.lines.map((raw) => {
    const l = object(raw),
      itemId = l.itemId ? identifier(l.itemId) : undefined;
    if (itemId && !goods.some((g) => g.id === itemId))
      throw new Error("Choose a current inventory item");
    return {
      ...(itemId ? { itemId } : {}),
      ...(l.sku ? { sku: textValue(l.sku, 100) } : {}),
      ...(!itemId && l.createCatalog === true ? { createCatalog: true, ...(l.catalogName ? { catalogName: textValue(l.catalogName) } : {}), ...(l.catalogCategory ? { catalogCategory: textValue(l.catalogCategory, 80) } : {}) } : {}),
      description: textValue(l.description, 300),
      quantity: amount(l.quantity),
      unit: validateInventoryUnit(l.unit),
      unitPrice: amount(l.unitPrice, false, 99999999),
      lineTotal: amount(l.lineTotal, false, 99999999),
    };
  });
  if (v.status !== "draft" && v.status !== "reviewed")
    throw new Error("Choose draft or reviewed");
  if (v.status === "reviewed" && !lines.length)
    throw new Error("Add invoice lines before reviewing");
  return {
    id,
    version: (previous?.version || 0) + 1,
    supplierId: supplier.id,
    supplierName: supplier.name,
    number: textValue(v.number, 120, false),
    date,
    total: amount(v.total, false, 99999999),
    ...(orderId ? { orderId } : {}),
    ...(v.attachmentId ? { attachmentId: identifier(v.attachmentId) } : {}),
    rawText: textValue(v.rawText, 50000, false),
    status: v.status,
    lines,
    createdAt: previous?.createdAt || at,
    updatedAt: at,
  };
}

export function reconcileInvoice(
  invoice: Invoice,
  order?: PurchaseOrder,
  receipts: Receipt[] = [],
): string[] {
  const warnings: string[] = [];
  const cents = (n: number) => Math.round(n * 100);
  const totals = new Map<string, number>();
  for (const line of invoice.lines) {
    if (
      Math.abs(cents(line.quantity * line.unitPrice) - cents(line.lineTotal)) >
      1
    )
      warnings.push(
        `${line.description}: quantity × price differs from line total`,
      );
    if (!line.itemId) {
      warnings.push(`${line.description}: item not matched`);
      continue;
    }
    const key = `${line.itemId}|${line.unit}`;
    totals.set(
      key,
      Math.round(((totals.get(key) || 0) + line.quantity) * 100) / 100,
    );
    if (order && !order.lines.some((l) => l.itemId === line.itemId))
      warnings.push(`${line.description}: not on linked order`);
  }
  if (order)
    for (const ordered of order.lines) {
      const matched = invoice.lines.filter((l) => l.itemId === ordered.itemId);
      if (!matched.length) {
        warnings.push(`${ordered.name}: missing from invoice`);
        continue;
      }
      if (matched.some((l) => l.unit !== ordered.unit))
        warnings.push(
          `${ordered.name}: invoice and order units differ; verify package size`,
        );
      const quantity = totals.get(`${ordered.itemId}|${ordered.unit}`) || 0;
      if (quantity !== ordered.quantity)
        warnings.push(
          `${ordered.name}: invoiced quantity differs from ordered quantity`,
        );
      if (quantity !== ordered.receivedQuantity)
        warnings.push(
          `${ordered.name}: invoiced quantity differs from received quantity`,
        );
      const damaged = receipts
        .filter((r) => r.orderId === order.id)
        .flatMap((r) => r.lines)
        .filter((l) => l.itemId === ordered.itemId)
        .reduce((n, l) => n + l.damagedQuantity, 0);
      if (damaged > 0)
        warnings.push(
          `${ordered.name}: ${damaged} ${ordered.unit} damaged; check credit or replacement`,
        );
    }
  const sum = invoice.lines.reduce((n, l) => n + cents(l.lineTotal), 0);
  if (Math.abs(sum - cents(invoice.total)) > 1)
    warnings.push(
      "Invoice total differs from item subtotal; check taxes, fees, credits or missing lines",
    );
  return warnings;
}

export const OPERATIONS_RESPONSE_BUDGET = 2 * 1024 * 1024;
export function serializedBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}
// Stored audit snapshots remain complete. Responses retain identifying facts and
// quantities without duplicating OCR text or whole invoice descriptions.
export function activitySummary(event: Activity): Activity {
  const summarize = (value: unknown): unknown => {
    if (!value || typeof value !== "object") return value;
    const record = value as Record<string, unknown>,
      result: Record<string, unknown> = {};
    for (const key of [
      "id",
      "itemId",
      "orderId",
      "name",
      "supplierId",
      "supplierName",
      "number",
      "status",
      "quantity",
      "unit",
      "total",
      "version",
      "countedAt",
      "receivedAt",
      "lastCountQuantity",
      "lastCountUnit",
      "stockSource",
    ])
      if (record[key] !== undefined) result[key] = record[key];
    if (Array.isArray(record.lines))
      result.lines = record.lines.map((line) => {
        const v = line as Record<string, unknown>;
        return {
          itemId: v.itemId,
          quantity: v.quantity,
          receivedQuantity: v.receivedQuantity,
          damagedQuantity: v.damagedQuantity,
          unit: v.unit,
        };
      });
    return result;
  };
  return {
    ...event,
    before: summarize(event.before),
    after: summarize(event.after),
  };
}
export function budgetOperationsBoard(
  source: OperationsBoard,
  budget = OPERATIONS_RESPONSE_BUDGET,
): OperationsBoard {
  const board: OperationsBoard = {
    ...source,
    orders: [...source.orders],
    invoices: [...source.invoices],
    receipts: [...source.receipts],
    events: source.events.map(activitySummary),
  };
  // Catalog and current stock are never omitted. Old completed history is
  // removed first; open orders are retained until all other history is exhausted.
  let bytes = serializedBytes(board);
  const reserve = Math.min(1024, Math.floor(budget / 10));
  const subtract = (value: unknown) => {
    bytes -= serializedBytes(value) + 1;
  };
  while (bytes > budget - reserve) {
    if (board.events.length) {
      subtract(board.events.pop());
      board.activityHasMore = true;
      continue;
    }
    if (board.invoices.length) {
      subtract(board.invoices.pop());
      board.historyHasMore = true;
      continue;
    }
    if (board.receipts.length) {
      subtract(board.receipts.pop());
      board.historyHasMore = true;
      continue;
    }
    const completed = board.orders.map((o) => o.status).lastIndexOf("received");
    if (completed >= 0) {
      subtract(board.orders.splice(completed, 1)[0]);
      board.historyHasMore = true;
      continue;
    }
    if (board.orders.length) {
      subtract(board.orders.pop());
      board.historyHasMore = true;
      board.activeOrdersTruncated = true;
      continue;
    }
    throw new Error(
      "Inventory catalog exceeds the response size limit. Contact a manager to archive unused supplier mappings.",
    );
  }
  if (board.historyHasMore || board.activeOrdersTruncated)
    board.historyRestart = true;
  return board;
}
export function budgetHistoryRecords<T extends { id: string }>(
  records: T[],
  hasMore: boolean,
  budget = OPERATIONS_RESPONSE_BUDGET,
): { records: T[]; nextCursor: string | null } {
  const included: T[] = [];
  let used = 0;
  for (const record of records) {
    const size = serializedBytes(record) + 1;
    if (used + size > budget - Math.min(1024, Math.floor(budget / 10))) break;
    included.push(record);
    used += size;
  }
  if (!included.length && records.length)
    throw new Error("This history record exceeds the response size limit.");
  return {
    records: included,
    nextCursor:
      (hasMore || included.length < records.length) && included.length
        ? included[included.length - 1].id
        : null,
  };
}

export function confirmStockLog(value: unknown, goods: CatalogGood[], stock: InventoryRecords, customUnits: string[], today: string, at: string, by: string) {
  const v = object(value);
  if (v.date !== today) throw new Error('The restaurant date changed. Refresh and review this stock log again.');
  const text = textValue(v.text, 20000);
  if (!Array.isArray(v.lines) || !v.lines.length || v.lines.length > 200) throw new Error('Confirm 1–200 inventory items at a time');
  const updates: InventoryRecords = {}, seen = new Set<string>();
  let units = [...customUnits];
  const lines = v.lines.map(raw => {
    const line = object(raw), itemId = identifier(line.itemId);
    if (!goods.some(g => g.id === itemId)) throw new Error('Match every included row to a current inventory item');
    if (seen.has(itemId)) throw new Error('The log contains this item more than once. Resolve duplicates before confirming.');
    seen.add(itemId);
    const registered = registerInventoryUnit(line.unit, units); units = registered.customUnits;
    const after = countInput({ ...line, unit: registered.unit }, stock[itemId], today, at, by);
    updates[itemId] = after;
    return { itemId, before: stock[itemId] || null, after };
  });
  return { updates, customUnits: units, text, lines };
}
