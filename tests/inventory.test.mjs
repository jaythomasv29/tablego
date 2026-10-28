import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryCountedAt, validateInventoryUnit, registerInventoryUnit, inventoryUnitOptions, inventoryTileState, inventoryChange, inventoryChecked, inventoryReady, inventoryOrderText, inventoryDefaultUnit, nextInventoryDate } from '../src/lib/inventory/model.ts';
import { workGoods } from '../src/lib/work/goods.ts';
const date = '2026-10-25', at = '2026-10-25T22:00:00Z';
const input = { itemId: workGoods[0].id, quantity: 2.5, unit: 'lb', action: 'sufficient', version: 0, orderQuantity: 2, orderUnit: 'case' };
test('sufficient stock saves a counted quantity and becomes due tomorrow', () => {
  const item = inventoryChange(input, undefined, date, at, 'BOH-Team');
  assert.equal(item.quantity, 2.5); assert.equal(item.unit, 'lb'); assert.equal(item.checkedAt, at); assert.equal(item.nextCheck, '2026-10-26');
  assert.equal(inventoryChecked(item, date), true); assert.equal(inventoryChecked(item, item.nextCheck), false);
  assert.equal(nextInventoryDate('2026-12-31'), '2027-01-01');
});
test('order queue persists across checks until stock is explicitly received', () => {
  const ordered = inventoryChange({ ...input, action: 'order' }, undefined, date, at, 'BOH-Team');
  assert.equal(ordered.orderOpen, true);
  const sufficient = inventoryChange({ ...input, version: 1 }, ordered, '2026-10-26', at, 'BOH-Team');
  assert.equal(sufficient.orderOpen, true); assert.equal(sufficient.orderRequestedAt, at);
  const received = inventoryChange({ ...input, version: 2, action: 'received' }, sufficient, '2026-10-26', at, 'BOH-Team');
  assert.equal(received.orderOpen, false); assert.equal(received.orderRequestedAt, null);
  assert.throws(() => inventoryChange({ ...input, action: 'received' }, undefined, date, at, 'BOH-Team'), /no open order/);
});
test('inventory rejects invalid counts, units, unknown goods, and stale edits', () => {
  for (const quantity of [-1, NaN, Infinity, '', 1000000, .001]) assert.throws(() => inventoryChange({ ...input, quantity }, undefined, date, at, 'BOH-Team'), /quantity/);
  assert.throws(() => inventoryChange({ ...input, itemId: '__proto__' }, undefined, date, at, 'BOH-Team'), /current inventory/);
  assert.throws(() => inventoryChange({ ...input, unit: 'unknown' }, undefined, date, at, 'BOH-Team'), /counting unit/);
  const item = inventoryChange(input, undefined, date, at, 'BOH-Team');
  assert.throws(() => inventoryChange(input, item, date, at, 'BOH-Team'), /another device/);
});
test('inventory completion requires all goods, regardless of screen filters', () => {
  const items = Object.fromEntries(workGoods.map(g => [g.id, inventoryChange({ ...input, itemId: g.id }, undefined, date, at, 'BOH-Team')]));
  assert.equal(inventoryReady(items, date), true);
  delete items[workGoods.at(-1).id]; assert.equal(inventoryReady(items, date), false);
});
test('order amounts are independent of on-hand amounts and require a positive quantity', () => {
  const ordered = inventoryChange({ ...input, quantity: 0, action: 'order', orderQuantity: 3, orderUnit: 'case' }, undefined, date, at, 'BOH-Team');
  assert.equal(ordered.quantity, 0); assert.equal(ordered.orderQuantity, 3); assert.equal(ordered.orderUnit, 'case');
  for (const orderQuantity of [undefined, 0, -1, NaN, .001, 1000000]) assert.throws(() => inventoryChange({ ...input, action: 'order', orderQuantity }, undefined, date, at, 'BOH-Team'), /quantity to order/);
  assert.throws(() => inventoryChange({ ...input, action: 'order', orderUnit: 'unknown' }, undefined, date, at, 'BOH-Team'), /ordering unit/);
});

test('shared list includes every open request and its buy quantity, not sufficient stock', () => {
  const item = inventoryChange({ ...input, quantity: 0, action: 'order', orderQuantity: 3, orderUnit: 'case' }, undefined, date, at, 'BOH-Team');
  const text = inventoryOrderText({ [workGoods[0].id]: item });
  assert.match(text, /3 case/); assert.doesNotMatch(text, /on hand|4 lbs|to order/);
  assert.equal(inventoryOrderText({ [workGoods[0].id]: { ...item, orderOpen: false } }), 'Restaurant order list');
  assert.equal(inventoryDefaultUnit('5 lb bag'), 'bag'); assert.equal(inventoryDefaultUnit('4 lbs'), 'lb'); assert.equal(inventoryDefaultUnit('Bunch'), 'bunch');
});
test('can works for counting, ordering, and package defaults', () => {
  const item = inventoryChange({ ...input, unit: 'can', action: 'order', orderUnit: 'can', orderQuantity: 12 }, undefined, date, at, 'BOH-Team');
  assert.equal(item.unit, 'can'); assert.equal(item.orderUnit, 'can'); assert.equal(inventoryDefaultUnit('6 cans'), 'can');
});
test('tile cues distinguish zero stock, open orders, fresh checks, and old checks', () => {
  const item = inventoryChange(input, undefined, date, at, 'BOH-Team');
  assert.equal(inventoryTileState(undefined, date), 'unchecked');
  assert.equal(inventoryTileState(item, date), 'checked');
  assert.equal(inventoryTileState(item, '2026-10-26'), 'stale');
  assert.equal(inventoryTileState({ ...item, orderOpen: true }, date), 'order');
  assert.equal(inventoryTileState({ ...item, quantity: 0, orderOpen: true }, date), 'out');
});

test('custom units normalize, deduplicate, and work independently for counts and orders', () => {
  const first = registerInventoryUnit('  large   tray  ');
  assert.equal(first.unit, 'large tray'); assert.deepEqual(first.customUnits, ['large tray']);
  assert.equal(registerInventoryUnit('LARGE TRAY', first.customUnits).added, false);
  assert.equal(registerInventoryUnit('CAN', first.customUnits).unit, 'can');
  const next = registerInventoryUnit('tub', first.customUnits);
  const item = inventoryChange({ ...input, unit: 'large tray', action: 'order', orderUnit: 'tub' }, undefined, date, at, 'BOH-Team', next.customUnits);
  assert.equal(item.unit, 'large tray'); assert.equal(item.orderUnit, 'tub');
  assert.equal(inventoryUnitOptions(next.customUnits).filter(u => u === 'can').length, 1);
  assert.throws(() => inventoryChange({ ...input, unit: 'unregistered' }, undefined, date, at, 'BOH-Team', next.customUnits), /custom unit first/);
});
test('custom unit labels are bounded and support international names', () => {
  assert.equal(validateInventoryUnit('ถุง'), 'ถุง'); assert.equal(validateInventoryUnit('1/2 tray'), '1/2 tray');
  for (const value of ['', '   ', '<script>', '__custom__', 'x'.repeat(25), null]) assert.throws(() => validateInventoryUnit(value), /unit name/);
  assert.throws(() => registerInventoryUnit('extra', Array.from({ length: 50 }, (_, i) => `unit ${i}`)), /50 custom/);
});

test('ordering needs no on-hand count and never turns an unknown quantity into zero', () => {
  const item = inventoryChange({ ...input, action: 'order', quantity: undefined, unit: undefined }, undefined, date, at, 'BOH-Team');
  assert.equal(item.quantity, null); assert.equal(item.countedAt, null); assert.equal(item.orderQuantity, 2); assert.equal(item.orderOpen, true);
  assert.equal(inventoryTileState(item, date), 'order');
});
test('next-day orders and sufficient reviews preserve the last real count and its time', () => {
  const original = inventoryChange(input, undefined, date, at, 'BOH-Team');
  const tomorrow = '2026-10-26', later = '2026-10-26T22:00:00Z';
  const ordered = inventoryChange({ ...input, version: 1, action: 'order', quantity: undefined, unit: 'case' }, original, tomorrow, later, 'BOH-Team');
  assert.equal(ordered.quantity, 2.5); assert.equal(ordered.unit, 'lb'); assert.equal(ordered.countedAt, at); assert.equal(ordered.checkedAt, later);
  assert.equal(inventoryChecked(original, tomorrow), false); assert.equal(inventoryChecked(ordered, tomorrow), true);
  const reviewed = inventoryChange({ ...input, version: 2, quantity: undefined }, ordered, tomorrow, later, 'BOH-Team');
  assert.equal(reviewed.quantity, 2.5); assert.equal(reviewed.countedAt, at);
  const recounted = inventoryChange({ ...input, version: 3, quantity: 1 }, reviewed, tomorrow, later, 'BOH-Team');
  assert.equal(recounted.quantity, 1); assert.equal(recounted.countedAt, later); assert.equal(original.quantity, 2.5);
});
test('legacy counts retain their original date when no new count is supplied', () => {
  const legacy = { ...inventoryChange(input, undefined, date, at, 'BOH-Team') }; delete legacy.countedAt;
  assert.equal(inventoryCountedAt(legacy), at);
  const next = inventoryChange({ ...input, version: 1, quantity: undefined }, legacy, '2026-10-26', '2026-10-26T22:00:00Z', 'BOH-Team');
  assert.equal(next.countedAt, at); assert.equal(next.quantity, 2.5);
});

test('custom goods participate in checks and copied requests without changing starter goods', () => {
  const goods = [{ id: 'custom-rice', name: 'House rice', category: 'Pantry', detail: '25 lb bag' }];
  const counted = inventoryChange({ itemId: 'custom-rice', version: 0, action: 'order', orderQuantity: 2, orderUnit: 'bag' }, undefined, '2026-10-28', '2026-10-28T18:00:00Z', 'Team', [], goods);
  assert.equal(counted.quantity, null);
  assert.equal(inventoryReady({ 'custom-rice': counted }, '2026-10-28', goods), true);
  assert.equal(inventoryReady({}, '2026-10-28', goods), false);
  assert.match(inventoryOrderText({ 'custom-rice': counted }, goods), /House rice — 2 bag/);
});

test('review without recount preserves receipt estimate and physical count snapshot', () => {
  const received = { version: 2, quantity: 14, unit: 'lb', countedAt: '2026-10-27T18:00:00Z', lastCountQuantity: 4, lastCountUnit: 'lb', stockSource: 'receipt', stockUpdatedAt: '2026-10-28T18:00:00Z', receivedAt: '2026-10-28T18:00:00Z', checkedAt: '2026-10-27T18:00:00Z', checkedOn: '2026-10-27', checkedBy: 'Team', decision: 'sufficient', nextCheck: '2026-10-28', orderOpen: false, orderRequestedAt: null };
  const reviewed = inventoryChange({ itemId: 'basil', version: 2, action: 'sufficient' }, received, '2026-10-28', '2026-10-28T19:00:00Z', 'Team');
  assert.equal(reviewed.quantity, 14); assert.equal(reviewed.lastCountQuantity, 4); assert.equal(reviewed.stockSource, 'receipt');
  const recounted = inventoryChange({ itemId: 'basil', version: 3, action: 'sufficient', quantity: 12, unit: 'lb' }, reviewed, '2026-10-28', '2026-10-28T20:00:00Z', 'Team');
  assert.equal(recounted.quantity, 12); assert.equal(recounted.lastCountQuantity, 12); assert.equal(recounted.stockSource, 'count');
});
