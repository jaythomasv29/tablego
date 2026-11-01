import { restaurantClock } from '../reservations/availability.ts';
import { inventoryChecked, inventoryCountedAt, type InventoryRecords } from './model.ts';
import type { OperationsBoard } from './operations.ts';
export function inventoryProgress(goods: {id:string}[], stock:InventoryRecords, today:string, timezone:string, draftIds:string[] = []) {
  const ids = new Set(goods.map(g => g.id));
  const reviewed = goods.filter(g => inventoryChecked(stock[g.id], today)).length;
  const counted = goods.filter(g => { const at=inventoryCountedAt(stock[g.id]); return at && restaurantClock(timezone,new Date(at)).date===today; }).length;
  return { total: goods.length, reviewed, counted, remaining: goods.length-reviewed, toOrder: goods.filter(g=>stock[g.id]?.orderOpen).length, unsaved: new Set(draftIds.filter(id=>ids.has(id))).size, percent: goods.length?Math.round(reviewed/goods.length*100):0 };
}
export function mergeInventoryBoard(previous:OperationsBoard|null, incoming:OperationsBoard):OperationsBoard {
  if (!previous) return incoming;
  const stock={...incoming.stock};
  for (const [id,item] of Object.entries(previous.stock)) if (!stock[id] || item.version>stock[id].version) stock[id]=item;
  const orders=new Map(incoming.orders.map(o=>[o.id,o]));
  for (const order of previous.orders) {
    const next=orders.get(order.id);
    if(!next || order.lines.reduce((sum,l)=>sum+l.receivedQuantity,0)>next.lines.reduce((sum,l)=>sum+l.receivedQuantity,0)) orders.set(order.id,order);
  }
  const invoices=new Map(incoming.invoices.map(i=>[i.id,i]));
  for (const invoice of previous.invoices) if (!invoices.has(invoice.id) || invoice.version>invoices.get(invoice.id)!.version) invoices.set(invoice.id,invoice);
  return {...incoming, stock, customUnits: Array.from(new Set([...previous.customUnits, ...incoming.customUnits])), goods:Array.from(new Map([...previous.goods,...incoming.goods].map(g=>[g.id,g])).values()), suppliers:Array.from(new Map([...previous.suppliers,...incoming.suppliers].map(s=>[s.id,s])).values()), offers:Array.from(new Map([...previous.offers,...incoming.offers].map(o=>[o.id,o])).values()), orders:Array.from(orders.values()).sort((a,b)=>b.orderedAt.localeCompare(a.orderedAt)), invoices:Array.from(invoices.values()).sort((a,b)=>b.date.localeCompare(a.date)), receipts:Array.from(new Map([...previous.receipts,...incoming.receipts].map(r=>[r.id,r])).values()).sort((a,b)=>b.at.localeCompare(a.at)), today:incoming.today<previous.today?previous.today:incoming.today};
}
export function storedInventoryDrafts(storage:Pick<Storage,'length'|'key'|'getItem'>,today:string,goods:{id:string}[]) {
 const ids=new Set(goods.map(g=>g.id)),dirty=new Set<string>(),prefix=`tablego-inline-stock:${today}:`;
 try { for(let i=0;i<storage.length;i++){ const key=storage.key(i);if(!key?.startsWith(prefix))continue;const id=key.slice(prefix.length).replace(/:pending$/,'');if(!ids.has(id))continue;try{const draft=JSON.parse(storage.getItem(key)||'null');if(draft && (key.endsWith(':pending') || typeof draft.quantity==='string'&&draft.quantity.trim() || draft.ordering===true))dirty.add(id);}catch{}} }catch{}
 return Array.from(dirty);
}
