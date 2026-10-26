import { workGoods } from '../work/goods.ts';
export interface InventoryItem { version: number; quantity: number; unit: string; checkedOn: string; checkedAt: string; checkedBy: string; decision: 'order' | 'sufficient'; nextCheck: string; orderOpen: boolean; orderRequestedAt: string | null; orderQuantity?: number; orderUnit?: string }
export type InventoryRecords = Record<string, InventoryItem>;
export const inventoryUnits = ['each', 'lb', 'oz', 'bag', 'box', 'case', 'bunch', 'bottle', 'gallon', 'pack'] as const;
export function nextInventoryDate(date: string) { const day = new Date(`${date}T12:00:00Z`); day.setUTCDate(day.getUTCDate() + 1); return day.toISOString().slice(0, 10); }
export function inventoryChecked(item: InventoryItem | undefined, date: string) { return Boolean(item && item.checkedOn === date && ['order', 'sufficient'].includes(item.decision)); }
export function inventoryReady(items: InventoryRecords, date: string) { return workGoods.every(good => inventoryChecked(items[good.id], date)); }
export function inventoryChange(input: Record<string, unknown>, previous: InventoryItem | undefined, date: string, at: string, by: string): InventoryItem {
  if (!workGoods.some(good => good.id === input.itemId)) throw new Error('Choose a current inventory item');
  if (!Number.isInteger(input.version) || input.version !== (previous?.version || 0)) throw new Error('This item changed on another device. Refresh before saving.');
  if (!['order', 'sufficient', 'received'].includes(String(input.action))) throw new Error('Choose Order or Recheck tomorrow');
  if (typeof input.quantity !== 'number' || !Number.isFinite(input.quantity) || input.quantity < 0 || input.quantity > 999999 || Math.round(input.quantity * 100) / 100 !== input.quantity) throw new Error('Enter a quantity from 0 to 999999, with up to two decimals');
  if (!inventoryUnits.includes(input.unit as typeof inventoryUnits[number])) throw new Error('Choose a counting unit');
  if (input.action === 'received' && !previous?.orderOpen) throw new Error('This item has no open order request');
  if (input.action === 'order' && (typeof input.orderQuantity !== 'number' || !Number.isFinite(input.orderQuantity) || input.orderQuantity <= 0 || input.orderQuantity > 999999 || Math.round(input.orderQuantity * 100) / 100 !== input.orderQuantity)) throw new Error('Enter a quantity to order greater than zero, with up to two decimals');
  if (input.action === 'order' && !inventoryUnits.includes(input.orderUnit as typeof inventoryUnits[number])) throw new Error('Choose an ordering unit');
  const orderOpen = input.action === 'order' || (input.action !== 'received' && Boolean(previous?.orderOpen));
  return { ...(previous?.orderQuantity !== undefined ? { orderQuantity: previous.orderQuantity, orderUnit: previous.orderUnit || previous.unit } : {}), ...(input.action === 'order' ? { orderQuantity: Number(input.orderQuantity), orderUnit: String(input.orderUnit) } : {}), version: (previous?.version || 0) + 1, quantity: input.quantity, unit: String(input.unit), checkedOn: date, checkedAt: at, checkedBy: by, decision: input.action === 'order' ? 'order' : 'sufficient', nextCheck: nextInventoryDate(date), orderOpen, orderRequestedAt: input.action === 'order' ? previous?.orderRequestedAt || at : input.action === 'received' ? null : previous?.orderRequestedAt || null };
}

export interface InventoryDraft { quantity: string; unit: string }
export function inventoryOrderText(items: InventoryRecords) {
  return ['Restaurant order list', ...workGoods.filter(g => items[g.id]?.orderOpen).map(g => { const item = items[g.id]; return `• ${g.name}${g.detail ? ` (${g.detail})` : ''}: ${item.orderQuantity !== undefined ? `${item.orderQuantity} ${item.orderUnit || item.unit} to order` : 'order amount not set'} · on hand ${item.quantity} ${item.unit}`; })].join('\n');
}
export function inventoryDefaultUnit(detail = '') {
  const value = detail.toLowerCase();
  for (const [pattern, unit] of [[/case/, 'case'], [/bag/, 'bag'], [/box/, 'box'], [/bunch/, 'bunch'], [/bottle/, 'bottle'], [/gallon/, 'gallon'], [/pack/, 'pack'], [/\blbs?\b/, 'lb'], [/\boz\b/, 'oz']] as const) if (pattern.test(value)) return unit;
  return 'each';
}
