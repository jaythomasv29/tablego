import { workGoods } from '../work/goods.ts';
export interface InventoryItem { version: number; quantity: number; unit: string; checkedOn: string; checkedAt: string; checkedBy: string; decision: 'order' | 'sufficient'; nextCheck: string; orderOpen: boolean; orderRequestedAt: string | null; orderQuantity?: number; orderUnit?: string }
export type InventoryRecords = Record<string, InventoryItem>;
export const inventoryUnits = ['each', 'lb', 'oz', 'bag', 'box', 'case', 'bunch', 'bottle', 'gallon', 'pack', 'can'] as const;
export function nextInventoryDate(date: string) { const day = new Date(`${date}T12:00:00Z`); day.setUTCDate(day.getUTCDate() + 1); return day.toISOString().slice(0, 10); }
export function inventoryChecked(item: InventoryItem | undefined, date: string) { return Boolean(item && item.checkedOn === date && ['order', 'sufficient'].includes(item.decision)); }
export function inventoryReady(items: InventoryRecords, date: string) { return workGoods.every(good => inventoryChecked(items[good.id], date)); }
export function inventoryChange(input: Record<string, unknown>, previous: InventoryItem | undefined, date: string, at: string, by: string, customUnits: string[] = []): InventoryItem {
  if (!workGoods.some(good => good.id === input.itemId)) throw new Error('Choose a current inventory item');
  if (!Number.isInteger(input.version) || input.version !== (previous?.version || 0)) throw new Error('This item changed on another device. Refresh before saving.');
  if (!['order', 'sufficient', 'received'].includes(String(input.action))) throw new Error('Choose Order or Recheck tomorrow');
  if (typeof input.quantity !== 'number' || !Number.isFinite(input.quantity) || input.quantity < 0 || input.quantity > 999999 || Math.round(input.quantity * 100) / 100 !== input.quantity) throw new Error('Enter a quantity from 0 to 999999, with up to two decimals');
  const unit = resolveInventoryUnit(input.unit, customUnits, 'counting');
  if (input.action === 'received' && !previous?.orderOpen) throw new Error('This item has no open order request');
  if (input.action === 'order' && (typeof input.orderQuantity !== 'number' || !Number.isFinite(input.orderQuantity) || input.orderQuantity <= 0 || input.orderQuantity > 999999 || Math.round(input.orderQuantity * 100) / 100 !== input.orderQuantity)) throw new Error('Enter a quantity to order greater than zero, with up to two decimals');
  const orderUnit = input.action === 'order' ? resolveInventoryUnit(input.orderUnit, customUnits, 'ordering') : undefined;
  const orderOpen = input.action === 'order' || (input.action !== 'received' && Boolean(previous?.orderOpen));
  return { ...(previous?.orderQuantity !== undefined ? { orderQuantity: previous.orderQuantity, orderUnit: previous.orderUnit || previous.unit } : {}), ...(input.action === 'order' ? { orderQuantity: Number(input.orderQuantity), orderUnit: orderUnit! } : {}), version: (previous?.version || 0) + 1, quantity: input.quantity, unit, checkedOn: date, checkedAt: at, checkedBy: by, decision: input.action === 'order' ? 'order' : 'sufficient', nextCheck: nextInventoryDate(date), orderOpen, orderRequestedAt: input.action === 'order' ? previous?.orderRequestedAt || at : input.action === 'received' ? null : previous?.orderRequestedAt || null };
}

export interface InventoryDraft { quantity: string; unit: string }
export function inventoryOrderText(items: InventoryRecords) {
  return ['Restaurant order list', ...workGoods.filter(g => items[g.id]?.orderOpen).map(g => { const item = items[g.id]; return `• ${g.name}${g.detail ? ` (${g.detail})` : ''}: ${item.orderQuantity !== undefined ? `${item.orderQuantity} ${item.orderUnit || item.unit} to order` : 'order amount not set'} · on hand ${item.quantity} ${item.unit}`; })].join('\n');
}
export function inventoryDefaultUnit(detail = '') {
  const value = detail.toLowerCase();
  for (const [pattern, unit] of [[/\bcans?\b/, 'can'], [/case/, 'case'], [/bag/, 'bag'], [/box/, 'box'], [/bunch/, 'bunch'], [/bottle/, 'bottle'], [/gallon/, 'gallon'], [/pack/, 'pack'], [/\blbs?\b/, 'lb'], [/\boz\b/, 'oz']] as const) if (pattern.test(value)) return unit;
  return 'each';
}

export function inventoryTileState(item: InventoryItem | undefined, date: string): 'unchecked' | 'out' | 'order' | 'stale' | 'checked' {
  if (!item) return 'unchecked';
  if (item.quantity === 0) return 'out';
  if (item.orderOpen) return 'order';
  return inventoryChecked(item, date) ? 'checked' : 'stale';
}
export const inventoryTileLabels = { unchecked: 'Not checked', out: 'Out of stock', order: 'Order flagged', stale: 'Recheck due', checked: 'Checked today' };

export function validateInventoryUnit(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Enter a unit name (1–24 characters)');
  const name = value.trim().replace(/\s+/g, ' ');
  if (!new RegExp("^[\\p{L}\\p{N}][\\p{L}\\p{M}\\p{N} .()/'-]{0,23}$", 'u').test(name)) throw new Error('Enter a unit name (1–24 letters, numbers, spaces, or simple punctuation)');
  return name;
}
export function inventoryUnitOptions(customUnits: string[] = []): string[] {
  const options: string[] = [...inventoryUnits];
  for (const name of customUnits) if (!options.some(unit => unit.toLocaleLowerCase() === name.toLocaleLowerCase())) options.push(name);
  return options;
}
export function registerInventoryUnit(value: unknown, customUnits: string[] = []) {
  const name = validateInventoryUnit(value), existing = inventoryUnitOptions(customUnits).find(unit => unit.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (existing) return { unit: existing, customUnits, added: false };
  if (customUnits.length >= 50) throw new Error('Up to 50 custom units can be saved');
  return { unit: name, customUnits: [...customUnits, name], added: true };
}
function resolveInventoryUnit(value: unknown, customUnits: string[], kind: string) {
  const unit = typeof value === 'string' ? inventoryUnitOptions(customUnits).find(option => option.toLocaleLowerCase() === value.trim().toLocaleLowerCase()) : undefined;
  if (!unit) throw new Error(`Choose a ${kind} unit or add a custom unit first`);
  return unit;
}
