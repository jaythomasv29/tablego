import { randomUUID } from 'node:crypto';
import { getServerDatabase } from '../serverFirebase';
import { businessTimezone } from '../reservations/policy';
import { restaurantClock } from '../reservations/availability';
import { ReservationError } from '../reservations/http';
import { inventoryChange, type InventoryRecords } from './model';
export async function getInventory() {
  const db = getServerDatabase();
  const [saved, general] = await Promise.all([db.doc('inventory/current').get(), db.doc('settings/general').get()]);
  const timezone = businessTimezone(general.data());
  return { items: (saved.data()?.items || {}) as InventoryRecords, today: restaurantClock(timezone).date, timezone };
}
export async function saveInventory(input: unknown, actor: string) {
  if (!input || typeof input !== 'object') throw new ReservationError('Enter an inventory check');
  const value = input as Record<string, unknown>, db = getServerDatabase();
  return db.runTransaction(async tx => {
    const [saved, general] = await Promise.all([tx.get(db.doc('inventory/current')), tx.get(db.doc('settings/general'))]);
    const date = restaurantClock(businessTimezone(general.data())).date;
    if (value.date !== date) throw new ReservationError('The restaurant date changed. Refresh before checking stock.', 409);
    const items = (saved.data()?.items || {}) as InventoryRecords, id = String(value.itemId);
    let item;
    try { item = inventoryChange(value, items[id], date, new Date().toISOString(), 'BOH-Team'); }
    catch (error) { throw new ReservationError((error as Error).message, /another device/.test((error as Error).message) ? 409 : 400); }
    tx.set(db.doc('inventory/current'), { items: { ...items, [id]: item } });
    tx.create(db.doc(`inventory/current/events/${randomUUID()}`), { action: value.action, itemId: id, before: items[id] || null, after: item, actor, at: item.checkedAt });
    return { item };
  });
}
