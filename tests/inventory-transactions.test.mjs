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
 const db={doc:path=>({path}),collection,runTransaction:async fn=>{const staged=new Map();let wrote=false;const tx={get:async ref=>{assert.equal(wrote,false,'transaction reads must precede writes');return snap(ref.path);},set:(ref,value)=>{wrote=true;staged.set(ref.path,structuredClone(value));},create:(ref,value)=>{assert.equal(records.has(ref.path)||staged.has(ref.path),false);wrote=true;staged.set(ref.path,structuredClone(value));}};const result=await fn(tx);for(const [path,value] of staged){records.set(path,value);writes.push(path);}return result;}};
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
