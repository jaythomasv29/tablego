import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryTileState, inventoryChange, inventoryChecked, inventoryReady, inventoryOrderText, inventoryDefaultUnit, nextInventoryDate } from '../src/lib/inventory/model.ts';
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
  assert.match(text, /3 case to order/); assert.match(text, /on hand 0 lb/);
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
