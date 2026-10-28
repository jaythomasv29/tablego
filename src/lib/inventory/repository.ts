import { getInventoryGoods } from './catalog';
import { randomUUID } from 'node:crypto';
import { getServerDatabase } from '../serverFirebase';
import { businessTimezone } from '../reservations/policy';
import { restaurantClock } from '../reservations/availability';
import { ReservationError } from '../reservations/http';
import { inventoryUnitOptions, registerInventoryUnit, inventoryChange, type InventoryRecords } from './model';
export async function getInventory() {
  const db = getServerDatabase();
  const [saved, general, goods] = await Promise.all([db.doc('inventory/current').get(), db.doc('settings/general').get(), getInventoryGoods()]);
  const timezone = businessTimezone(general.data());
  return { goods, customUnits: inventoryUnitOptions([...(saved.data()?.customUnits || []), ...goods.map(g => g.baseUnit || '').filter(Boolean)]).filter(u => !['each','lb','oz','bag','box','case','bunch','bottle','gallon','pack','can'].includes(u)), items: (saved.data()?.items || {}) as InventoryRecords, today: restaurantClock(timezone).date, timezone };
}
export async function saveInventory(input: unknown, actor: string) {
  if (!input || typeof input !== 'object') throw new ReservationError('Enter an inventory check');
  const value = input as Record<string, unknown>, db = getServerDatabase(), goods = await getInventoryGoods();
  return db.runTransaction(async tx => {
    const [saved, general] = await Promise.all([tx.get(db.doc('inventory/current')), tx.get(db.doc('settings/general'))]);
    const date = restaurantClock(businessTimezone(general.data())).date;
    if (value.date !== date) throw new ReservationError('The restaurant date changed. Refresh before checking stock.', 409);
    const customUnits = (saved.data()?.customUnits || []) as string[];
    if (value.action === 'addUnit') {
      let result;
      try { result = registerInventoryUnit(value.unit, customUnits); }
      catch (error) { throw new ReservationError((error as Error).message); }
      if (result.added) {
        tx.set(db.doc('inventory/current'), { ...saved.data(), customUnits: result.customUnits });
        tx.create(db.doc(`inventory/current/events/${randomUUID()}`), { action: 'unit.added', unit: result.unit, actor, at: new Date().toISOString() });
      }
      return { unit: result.unit, customUnits: result.customUnits };
    }
    const items = (saved.data()?.items || {}) as InventoryRecords, id = String(value.itemId);
    let item;
    try { item = inventoryChange(value, items[id], date, new Date().toISOString(), 'BOH-Team', inventoryUnitOptions([...customUnits, ...goods.map(g => g.baseUnit || '').filter(Boolean)]), goods); }
    catch (error) { throw new ReservationError((error as Error).message, /another device/.test((error as Error).message) ? 409 : 400); }
    tx.set(db.doc('inventory/current'), { ...saved.data(), items: { ...items, [id]: item } });
    tx.create(db.doc(`inventory/current/events/${randomUUID()}`), { action: value.action, itemId: id, before: items[id] || null, after: item, actor, at: item.updatedAt || item.checkedAt });
    return { item };
  });
}

export async function getInventoryHistory(itemId: string) {
  const goods = await getInventoryGoods();
  if (!goods.some(good => good.id === itemId)) throw new ReservationError('Choose a current inventory item');
  const events = await getServerDatabase().collection('inventory/current/events').where('itemId', '==', itemId).orderBy('at', 'desc').limit(30).get();
  return { events: events.docs.map(doc => { const event = doc.data(); return { id: doc.id, action: event.action, at: event.at, before: event.before || null, after: event.after || null }; }) };
}
