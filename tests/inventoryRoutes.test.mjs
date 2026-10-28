import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
function route(path, overrides = {}) {
 const file = new URL(`../src/app/api/staff/inventory/${path}/route.ts`,import.meta.url), require = createRequire(file), module={exports:{}}, effects=[];
 class ReservationError extends Error { constructor(message,status=400) {super(message);this.status=status;} }
 const effect = name => async () => {effects.push(name);return {};};
 const imports = {
  '@/lib/auth/admin':{requireAdmin:async request => request.foreign && request.method !== 'GET' ? {status:403} : request.admin ? null : {status:401},adminSession:async () => {effects.push('session');return {id:'test-session'};}},
  '@/lib/auth/rateLimit':{rateLimit:async () => null},
  '@/lib/reservations/http':{privateJson:(data,status=200)=>({data,status}),reservationError:error=>({status:error.status||503}),ReservationError},
  '@/lib/inventory/operationsRepository':{getOperations:effect('board-read'),getOperationsHistory:effect('history-read'),mutateOperations:effect('mutation')},
  '@/lib/inventory/attachmentRepository':{readInvoiceAttachment:effect('attachment-read'),storeInvoiceAttachment:effect('attachment-write')},
  '@/lib/inventory/invoiceExtraction':{MAX_INVOICE_BYTES:3*1024*1024},...overrides,
 };
 runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,require:name=>imports[name]||require(name),URL,Request,Response,File,Uint8Array,Number});
 const request = (method,flags={})=>({method,url:`https://test.invalid/api/staff/inventory/${path}?id=unknown`,headers:new Headers(),json:async()=>{effects.push('body-read');return {};},formData:async()=>{effects.push('file-read');return new FormData();},...flags});
 return {api:module.exports,effects,request};
}
test('inventory operations blocks anonymous reads, history and writes before datastore or body reads',async()=>{
 const r=route('operations');
 for(const method of ['GET','POST']) assert.equal((await r.api[method](r.request(method))).status,401);
 assert.equal((await r.api.GET(r.request('GET',{url:'https://test.invalid/api/staff/inventory/operations?history=orders'}))).status,401);
 assert.deepEqual(r.effects,[]);
});
test('inventory operations rejects authenticated cross-origin writes before reading stock or body',async()=>{
 const r=route('operations');
 assert.equal((await r.api.POST(r.request('POST',{admin:true,foreign:true}))).status,403);
 assert.deepEqual(r.effects,[]);
});
test('invoice uploads and downloads reject anonymous requests before attachment access',async()=>{
 const r=route('attachments');
 for(const method of ['GET','POST']) assert.equal((await r.api[method](r.request(method))).status,401);
 assert.deepEqual(r.effects,[]);
});
test('invoice upload rejects foreign origins before parsing multipart or writing attachments',async()=>{
 const r=route('attachments');
 assert.equal((await r.api.POST(r.request('POST',{admin:true,foreign:true}))).status,403);
 assert.deepEqual(r.effects,[]);
});
test('oversized authenticated invoice upload stops before multipart parsing or attachment storage',async()=>{
 const r=route('attachments');
 assert.equal((await r.api.POST(r.request('POST',{admin:true,headers:new Headers({'content-length':String(4*1024*1024)})}))).status,400);
 assert.deepEqual(r.effects,['session']);
});
test('operations rate limiting stops before JSON parsing or mutations',async()=>{
 const r=route('operations',{'@/lib/auth/rateLimit':{rateLimit:async()=>({status:429})}});
 assert.equal((await r.api.POST(r.request('POST',{admin:true}))).status,429);assert.deepEqual(r.effects,['session']);
});
test('operations oversized JSON is rejected without reading body or mutating',async()=>{
 const r=route('operations');assert.equal((await r.api.POST(r.request('POST',{admin:true,headers:new Headers({'content-length':'250001'})}))).status,413);assert.deepEqual(r.effects,['session']);
});
test('authorized board and history reads select the correct repository without mutation',async()=>{
 const r=route('operations');assert.equal((await r.api.GET(r.request('GET',{admin:true}))).status,200);assert.equal((await r.api.GET(r.request('GET',{admin:true,url:'https://test.invalid/api/staff/inventory/operations?history=invoices'}))).status,200);assert.deepEqual(r.effects,['board-read','history-read']);
});
