import { inventoryChecked, inventoryCountedAt, inventoryDefaultUnit, type CheckGood, type InventoryRecords } from './model.ts';

export interface DailyStockRow {
  id: string;
  name: string;
  detail: string;
  category: string;
  location: string;
  quantity: number | null;
  unit: string;
  checkedAt: string | null;
  countedAt: string | null;
  reviewedToday: boolean;
  orderOpen: boolean;
  state: 'checked' | 'due' | 'unchecked' | 'out' | 'order';
}
export interface DailyStockBoard {
  today: string;
  timezone: string;
  updatedAt: string;
  rows: DailyStockRow[];
}
export const dailyStockLabels = {
  checked: 'Checked today', due: 'Needs check', unchecked: 'Never checked', out: 'Out of stock', order: 'To order',
};
/** Deliberate read-only projection: no supplier, pricing, invoice, staff or session data. */
export function dailyStockBoard(goods: CheckGood[], stock: InventoryRecords, today: string, timezone: string, updatedAt = new Date().toISOString()): DailyStockBoard {
  return { today, timezone, updatedAt, rows: goods.map((good): DailyStockRow => {
    const item = stock[good.id];
    const quantity = item?.stockSource === 'receipt' ? item.lastCountQuantity ?? null : item?.quantity ?? null;
    const unit = item?.stockSource === 'receipt' ? item.lastCountUnit || item.unit : item?.unit || good.baseUnit || inventoryDefaultUnit(good.detail);
    const countedAt = quantity === null ? null : inventoryCountedAt(item);
    const reviewedToday = inventoryChecked(item, today);
    const checkedAt = item?.checkedAt || null;
    return { id: good.id, name: good.name, detail: good.detail || '', category: good.category || 'Unsorted goods', location: good.location || '', quantity, unit, checkedAt, countedAt, reviewedToday, orderOpen: !!item?.orderOpen,
      state: quantity === 0 ? 'out' : item?.orderOpen ? 'order' : reviewedToday ? 'checked' : checkedAt ? 'due' : 'unchecked' };
  }).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name) || a.detail.localeCompare(b.detail)) };
}
export function dailyStockSummary(board: DailyStockBoard) {
  const reviewed = board.rows.filter(row => row.reviewedToday).length;
  return { total: board.rows.length, reviewed, remaining: board.rows.length - reviewed, out: board.rows.filter(row => row.quantity === 0).length };
}
