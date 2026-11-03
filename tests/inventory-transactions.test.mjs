import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as operations from '../src/lib/inventory/operations.ts';
import * as model from '../src/lib/inventory/model.ts';
import * as invoiceCatalog from '../src/lib/inventory/invoiceCatalog.ts';
function fixture(){
 const records=new Map([['inventory/current',{customUnits:[],items:{}}],['settings/general',{}]]), writes=[];
 const snap=path=>({id:path.split('/').at(-1),exists:records.has(path),data:()=>records.has(path)?structuredClone(records.get(path)):undefined});
 function collection(path){const query={path,where:()=>query,orderBy:()=>query,limit:()=>query,get:async()=>{const docs=Array.from(records.keys()).filter(k=>k.startsWith(path+'/')&&!k.slice(path.length+1).includes('/')).map(snap);return {docs,size:docs.length};}};return query;}
 const db={doc:path=>({path}),collection,runTransaction:async fn=>{const staged=new Map();let wrote=false;const tx={get:async ref=>{assert.equal(wrote,false,'transaction reads must precede writes');return ref.get ? ref.get() : snap(ref.path);},set:(ref,value)=>{wrote=true;staged.set(ref.path,structuredClone(value));},create:(ref,value)=>{assert.equal(records.has(ref.path)||staged.has(ref.path),false);wrote=true;staged.set(ref.path,structuredClone(value));}};const result=await fn(tx);for(const [path,value] of staged){records.set(path,value);writes.push(path);}return result;}};
 class ReservationError extends Error{constructor(message,status=400){super(message);this.status=status;}}
 const file=new URL('../src/lib/inventory/operationsRepository.ts',import.meta.url),require=createRequire(file),module={exports:{}};
 const imports={'../serverFirebase':{getServerDatabase:()=>db},'./repository':{getInventory:async()=>({items:structuredClone(records.get('inventory/current').items),customUnits:records.get('inventory/current').customUnits,today:'2026-10-28',timezone:'America/Los_Angeles'})},'../reservations/policy':{businessTimezone:()=> 'America/Los_Angeles'},'../reservations/availability':{restaurantClock:()=>({date:'2026-10-28'})},'../reservations/http':{ReservationError},'./operations':operations,'./invoiceCatalog':invoiceCatalog,'./model':model};
 runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,require:name=>imports[name]||require(name),Date,Buffer,process,console});
 return {repository:module.exports,records,writes};
}
const log={action:'confirmTextLog',requestId:'log-1',date:'2026-10-28',text:'Basil 2 lb, broccoli 3 case',lines:[{itemId:'basil',quantity:2,unit:'lb',version:0},{itemId:'broccoli',quantity:3,unit:'case',version:0}]};
test('confirming a text log atomically counts every reviewed line and keeps retry idempotent',async()=>{
 const {repository,records,writes}=fixture();await repository.mutateOperations(log,'staff-session');
 assert.equal(records.get('inventory/current').items.basil.quantity,2);assert.equal(records.get('inventory/current').items.broccoli.quantity,3);
 const before=JSON.stringify(Array.from(records.entries())),writeCount=writes.length;
 await repository.mutateOperations(log,'staff-session');assert.equal(JSON.stringify(Array.from(records.entries())),before);assert.equal(writes.length,writeCount);
 assert.equal(Array.from(records.keys()).filter(k=>k.startsWith('inventory/current/events/')).length,2);
});
test('one stale or invalid text-log row prevents every stock, custom unit and audit write',async()=>{
 for(const bad of [{...log.lines[1],version:3},{...log.lines[1],quantity:-1},{...log.lines[1],itemId:'missing'}]){
 const {repository,records,writes}=fixture();const before=JSON.stringify(Array.from(records.entries()));
 await assert.rejects(repository.mutateOperations({...log,lines:[{...log.lines[0],unit:'tub'},bad]},'staff-session'));
 assert.equal(JSON.stringify(Array.from(records.entries())),before);assert.equal(writes.length,0);
 }
});
test('receiving records arrival history without writing on-hand stock',async()=>{
 const {repository,records,writes}=fixture();const order={id:'order-1',supplierId:'vendor',supplierName:'Vendor',status:'ordered',orderedAt:'2026-10-28T00:00:00Z',orderedBy:'Team',lines:[{itemId:'basil',name:'Basil',supplierItemName:'Thai basil',sku:'B1',quantity:2,unit:'case',packSize:4,packUnit:'lb',receivedQuantity:0}]};
 records.set('inventoryOperations/orders/records/order-1',order);
 await repository.mutateOperations({action:'receive',requestId:'receipt-1',orderId:'order-1',lines:[{itemId:'basil',receivedQuantity:1,damagedQuantity:0}]},'staff-session');
 assert.equal(writes.includes('inventory/current'),false);assert.deepEqual(records.get('inventory/current').items,{});
 assert.equal(records.get('inventoryOperations/orders/records/order-1').status,'partial');
 assert.equal(Array.from(records.values()).filter(value=>value.action==='arrival').length,1);
});
test('saving a reviewed invoice preserves current stock exactly',async()=>{
 const {repository,records,writes}=fixture();records.set('inventoryOperations/suppliers/records/vendor',{id:'vendor',name:'Vendor'});
 await repository.mutateOperations({action:'saveInvoice',invoice:{supplierId:'vendor',version:0,number:'INV1',date:'2026-10-28',total:20,status:'reviewed',lines:[{itemId:'basil',description:'Basil',quantity:2,unit:'case',unitPrice:10,lineTotal:20}]}},'staff-session');
 assert.equal(writes.includes('inventory/current'),false);assert.deepEqual(records.get('inventory/current').items,{});
 assert.equal(Array.from(records.keys()).filter(k=>k.startsWith('inventoryOperations/invoices/records/')).length,1);
});
test('text-log request IDs cannot replay a changed payload or another staff session',async()=>{
 const {repository,records,writes}=fixture();await repository.mutateOperations(log,'staff-session');const before=JSON.stringify(Array.from(records.entries())),writeCount=writes.length;
 await assert.rejects(repository.mutateOperations({...log,text:'Changed after confirmation'},'staff-session'),/already used/);
 await assert.rejects(repository.mutateOperations(log,'different-session'),/already used/);
 assert.equal(JSON.stringify(Array.from(records.entries())),before);assert.equal(writes.length,writeCount);
});
test('duplicate matched stock-log rows require resolution and leave saved counts untouched',async()=>{
 const {repository,records,writes}=fixture();
 await assert.rejects(repository.mutateOperations({...log,lines:[log.lines[0],{...log.lines[0],quantity:4}]},'staff-session'),/more than once/);
 assert.deepEqual(records.get('inventory/current').items,{});assert.equal(writes.length,0);
});
const newGoodsInvoice = status=>({action:'saveInvoice',invoice:{supplierId:'vendor',version:0,number:'NEW1',date:'2026-10-28',total:24,status,lines:[{description:'Baby corn cans',quantity:12,unit:'can',unitPrice:2,lineTotal:24,createCatalog:true}]}});
test('explicit reviewed invoice catalog creation saves item and supplier mapping without on-hand stock',async()=>{
 const {repository,records,writes}=fixture();records.set('inventoryOperations/suppliers/records/vendor',{id:'vendor',name:'Vendor'});
 await repository.mutateOperations(newGoodsInvoice('reviewed'),'staff-session');
 const goods=Array.from(records.entries()).filter(([key])=>key.startsWith('inventoryOperations/goods/records/'));
 const offers=Array.from(records.entries()).filter(([key])=>key.startsWith('inventoryOperations/offers/records/'));
 assert.equal(goods.length,1);assert.equal(goods[0][1].name,'Baby corn cans');assert.equal(goods[0][1].category,'Unsorted goods');assert.equal(goods[0][1].baseUnit,'can');
 assert.equal(offers.length,1);assert.equal(offers[0][1].itemId,goods[0][1].id);assert.equal(offers[0][1].supplierId,'vendor');assert.equal(offers[0][1].supplierItemName,'Baby corn cans');
 assert.equal(writes.includes('inventory/current'),false);assert.deepEqual(records.get('inventory/current').items,{});
 const saved=Array.from(records.entries()).find(([key])=>key.startsWith('inventoryOperations/invoices/records/'))[1];
 assert.equal(saved.lines[0].itemId,goods[0][1].id);
 await repository.mutateOperations({action:'saveInvoice',invoice:saved},'staff-session');
 assert.equal(Array.from(records.keys()).filter(key=>key.startsWith('inventoryOperations/goods/records/')).length,1);
 assert.equal(Array.from(records.keys()).filter(key=>key.startsWith('inventoryOperations/offers/records/')).length,1);
});
test('draft invoice retains explicit catalog intent without creating item, supplier mapping or count',async()=>{
 const {repository,records,writes}=fixture();records.set('inventoryOperations/suppliers/records/vendor',{id:'vendor',name:'Vendor'});
 await repository.mutateOperations(newGoodsInvoice('draft'),'staff-session');
 assert.equal(Array.from(records.keys()).filter(key=>key.startsWith('inventoryOperations/goods/records/')).length,0);
 assert.equal(Array.from(records.keys()).filter(key=>key.startsWith('inventoryOperations/offers/records/')).length,0);
 assert.equal(writes.includes('inventory/current'),false);
 const saved=Array.from(records.entries()).find(([key])=>key.startsWith('inventoryOperations/invoices/records/'))[1];assert.equal(saved.lines[0].createCatalog,true);
});
test('reviewed catalog creation reuses exact known goods and refuses ambiguous names atomically',async()=>{
 const existing=fixture();existing.records.set('inventoryOperations/suppliers/records/vendor',{id:'vendor',name:'Vendor'});
 const input=newGoodsInvoice('reviewed');input.invoice.lines[0].description='Basil';
 await existing.repository.mutateOperations(input,'staff-session');
 assert.equal(Array.from(existing.records.keys()).filter(key=>key.startsWith('inventoryOperations/goods/records/')).length,0);
 const saved=Array.from(existing.records.entries()).find(([key])=>key.startsWith('inventoryOperations/invoices/records/'))[1];assert.equal(saved.lines[0].itemId,'basil');
 const ambiguous=fixture();ambiguous.records.set('inventoryOperations/suppliers/records/vendor',{id:'vendor',name:'Vendor'});
 ambiguous.records.set('inventoryOperations/goods/records/second-basil',{id:'second-basil',name:'Basil',category:'Produce',baseUnit:'lb'});
 const before=JSON.stringify(Array.from(ambiguous.records.entries()));
 await assert.rejects(ambiguous.repository.mutateOperations(input,'staff-session'),/choose|ambiguous|match/i);
 assert.equal(JSON.stringify(Array.from(ambiguous.records.entries())),before);assert.equal(ambiguous.writes.length,0);
});
const quick={action:'checkItem',requestId:'quick-1',itemId:'basil',date:'2026-10-28',version:0,decision:'order',quantity:3,unit:'basket',orderQuantity:2,orderUnit:'tray'};
test('quick count plus request commits once and identical retry creates no duplicate stock version or audit',async()=>{
 const {repository,records,writes}=fixture();await repository.mutateOperations(quick,'staff-session');const saved=records.get('inventory/current');assert.equal(saved.items.basil.quantity,3);assert.equal(saved.items.basil.orderQuantity,2);assert.equal(saved.items.basil.version,1);assert.deepEqual(saved.customUnits,['basket','tray']);
 const before=JSON.stringify(Array.from(records.entries())),writeCount=writes.length;
 await repository.mutateOperations(quick,'staff-session');assert.equal(JSON.stringify(Array.from(records.entries())),before);assert.equal(writes.length,writeCount);assert.equal(Array.from(records.keys()).filter(k=>k.startsWith('inventory/current/events/')).length,1);
 await assert.rejects(repository.mutateOperations({...quick,requestId:'quick-duplicate'},'staff-session'),error=>error.status===409&&/another device/.test(error.message));assert.equal(JSON.stringify(Array.from(records.entries())),before);assert.equal(writes.length,writeCount);
});
test('quick stale date and version errors commit no count, order, custom unit or audit changes',async()=>{
 for(const patch of [{date:'2026-10-27'},{version:3}]){const {repository,records,writes}=fixture(),before=JSON.stringify(Array.from(records.entries()));await assert.rejects(repository.mutateOperations({...quick,...patch},'staff-session'),error=>error.status===409);assert.equal(JSON.stringify(Array.from(records.entries())),before);assert.equal(writes.length,0);}
});
test('quick order without quantity preserves last count then cancellation preserves review date',async()=>{
 const {repository,records,writes}=fixture(),old={version:1,quantity:8,unit:'lb',countedAt:'2026-10-26T20:00:00Z',lastCountQuantity:8,lastCountUnit:'lb',checkedAt:'2026-10-26T20:00:00Z',checkedOn:'2026-10-26',checkedBy:'Team',decision:'sufficient',nextCheck:'2026-10-27',orderOpen:false,orderRequestedAt:null};records.set('inventory/current',{customUnits:[],items:{basil:old}});
 await repository.mutateOperations({...quick,version:1,quantity:undefined,unit:undefined},'staff-session');const ordered=records.get('inventory/current').items.basil;assert.equal(ordered.quantity,8);assert.equal(ordered.countedAt,old.countedAt);assert.equal(ordered.checkedOn,'2026-10-28');assert.equal(ordered.orderOpen,true);
 await repository.mutateOperations({action:'checkItem',requestId:'cancel-quick',itemId:'basil',date:'2026-10-28',version:2,decision:'cancelOrder'},'staff-session');const cancelled=records.get('inventory/current').items.basil;assert.equal(cancelled.quantity,8);assert.equal(cancelled.countedAt,old.countedAt);assert.equal(cancelled.checkedOn,ordered.checkedOn);assert.equal(cancelled.checkedAt,ordered.checkedAt);assert.equal(cancelled.orderOpen,false);assert.equal(cancelled.version,3);assert.equal(Array.from(records.keys()).filter(k=>k.startsWith('inventoryOperations/orders/records/')).length,0);assert.equal(writes.filter(k=>k==='inventory/current').length,2);
});
test('quick internal order without any known count never invents zero on hand',async()=>{const {repository,records}=fixture();await repository.mutateOperations({...quick,quantity:undefined,unit:undefined},'staff-session');const item=records.get('inventory/current').items.basil;assert.equal(item.quantity,null);assert.equal(item.countedAt,null);assert.equal(item.orderOpen,true);});
test('metadata create honors stable request ID and lost-response retry cannot duplicate catalog goods',async()=>{
 const {repository,records,writes}=fixture(),input={action:'saveGood',requestId:'metadata-good-1',good:{name:'Fresh test herb',category:'Produce',baseUnit:'bunch'}};
 await repository.mutateOperations(input,'staff-session');const saved=Array.from(records.entries()).filter(([key])=>key.startsWith('inventoryOperations/goods/records/'));assert.equal(saved.length,1);const before=JSON.stringify(Array.from(records.entries())),writeCount=writes.length;
 await repository.mutateOperations(input,'staff-session');assert.equal(JSON.stringify(Array.from(records.entries())),before);assert.equal(writes.length,writeCount);
 await assert.rejects(repository.mutateOperations({...input,good:{...input.good,name:'Changed after lost response'}},'staff-session'),error=>error.status===409&&/already used/.test(error.message));assert.equal(JSON.stringify(Array.from(records.entries())),before);assert.equal(writes.length,writeCount);
});

const newLog = {...log, requestId: 'new-log', lines: [{itemId: 'new-corn', quantity: 6, unit: 'can', version: 0, newGood: {name: 'Baby corn', category: 'Pantry', location: 'Shelf'}}]};
test('stock log creates catalog item and count together and retries exactly once', async () => {
 const {repository, records, writes} = fixture();
 await repository.mutateOperations(newLog, 'staff');
 assert.equal(records.get('inventoryOperations/goods/records/new-corn').name, 'Baby corn');
 assert.equal(records.get('inventoryOperations/goods/records/new-corn').baseUnit, 'can');
 assert.equal(records.get('inventory/current').items['new-corn'].quantity, 6);
 const count = writes.length;
 await repository.mutateOperations(newLog, 'staff');
 assert.equal(writes.length, count);
});
test('duplicate catalog names and invalid new counts leave all records untouched', async () => {
 for (const patch of [{newGood: {name: 'Basil', category: 'Produce'}}, {quantity: -1}, {version: 1}, {newGood: {name: '', category: 'Pantry'}}]) {
  const {repository, records, writes} = fixture(), before = JSON.stringify([...records]);
  await assert.rejects(repository.mutateOperations({...newLog, lines: [{...newLog.lines[0], ...patch}]}, 'staff'));
  assert.equal(JSON.stringify([...records]), before);
  assert.equal(writes.length, 0);
 }
});
test('new catalog rows reject duplicate names inside one stock log', async () => {
 const {repository, writes} = fixture();
 await assert.rejects(repository.mutateOperations({...newLog, lines: [newLog.lines[0], {...newLog.lines[0], itemId: 'other-corn'}]}, 'staff'), /already exists/);
 assert.equal(writes.length, 0);
});
