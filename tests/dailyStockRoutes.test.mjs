import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {issueSignedToken,verifySignedToken} from '../src/lib/auth/signedToken.ts';
const secret='daily-stock-route-test-secret-at-least-32-characters';
function route(path,{limited=false}={}) {
 const file=new URL(`../src/app/api/${path}/route.ts`,import.meta.url),require=createRequire(file),module={exports:{}},effects=[];
 class ReservationError extends Error {constructor(message,status=400){super(message);this.status=status;}}
 const imports={
 '@/lib/auth/admin':{requireAdmin:async r=>r.foreign&&r.method!=='GET'?Response.json({}, {status:403}):r.admin?null:Response.json({}, {status:401}),adminSession:async()=>({id:'staff-test'})},
 '@/lib/auth/rateLimit':{rateLimit:async()=>{effects.push('limit');return limited?Response.json({}, {status:429}):null;}},
 '@/lib/auth/signedToken':{issueSignedToken:(kind,data,ttl)=>issueSignedToken(kind,data,ttl,secret),verifySignedToken:(token,kind)=>verifySignedToken(token,kind,secret)},
 '@/lib/inventory/dailyStockRepository':{getDailyStock:async()=>{effects.push('read');return {today:'2026-11-02',rows:[{name:'Basil',quantity:2}]};}},
 '@/lib/reservations/http':{privateJson:value=>Response.json(value,{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}}),reservationError:error=>Response.json({error:error.message},{status:error.status||503}),ReservationError},
 };
 runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,require:name=>imports[name]||require(name),Date});
 const request=(method,flags={})=>({method,headers:new Headers(),...flags});
 return {api:module.exports,effects,request};
}
test('staff stock reads and link issuance require sign-in; foreign link issuance is forbidden', async()=>{
 const read=route('staff/inventory/daily-stock'),share=route('staff/inventory/daily-stock/share');
 assert.equal((await read.api.GET(read.request('GET'))).status,401);assert.deepEqual(read.effects,[]);
 assert.equal((await share.api.POST(share.request('POST'))).status,401);
 assert.equal((await share.api.POST(share.request('POST',{admin:true,foreign:true}))).status,403);assert.deepEqual(share.effects,[]);
});
test('authorized link issuance grants only seven-day stock-view scope and is rate limited',async()=>{
 const r=route('staff/inventory/daily-stock/share');const response=await r.api.POST(r.request('POST',{admin:true}));assert.equal(response.status,200);
 const data=await response.json(),claims=await verifySignedToken(data.token,'inventory-view',secret);
 assert.deepEqual(claims.data,{scope:'daily-stock'});assert.equal(data.expiresAt,new Date(claims.expiresAt*1000).toISOString());
 assert.ok(claims.expiresAt*1000-Date.now()<=7*86400000);assert.equal(await verifySignedToken(data.token,'admin',secret),null);
 assert.equal(response.headers.get('Cache-Control'),'no-store');assert.deepEqual(r.effects,['limit']);
 const blocked=route('staff/inventory/daily-stock/share',{limited:true});assert.equal((await blocked.api.POST(blocked.request('POST',{admin:true}))).status,429);
});
test('shared view rejects missing, expired, forged, wrong-kind and wrong-scope links before any data access',async()=>{
 const expired=await issueSignedToken('inventory-view',{scope:'daily-stock'},60,secret,Date.now()-120000);
 const admin=await issueSignedToken('admin',{},60,secret);const wrong=await issueSignedToken('inventory-view',{scope:'other'},60,secret);
 for(const token of ['',expired.token,admin.token,wrong.token,'forged.token']) {
  const r=route('inventory/daily-stock');assert.equal((await r.api.GET(r.request('GET',{headers:new Headers({Authorization:`Bearer ${token}`})}))).status,401);assert.deepEqual(r.effects,[]);
 }
});
test('valid shared links expose only read-only stock projection without browser caching',async()=>{
 const {token}=await issueSignedToken('inventory-view',{scope:'daily-stock'},60,secret);
 const r=route('inventory/daily-stock');const response=await r.api.GET(r.request('GET',{headers:new Headers({Authorization:`Bearer ${token}`})}));
 assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.deepEqual(r.effects,['limit','read']);assert.equal(r.api.POST,undefined);
 const blocked=route('inventory/daily-stock',{limited:true});assert.equal((await blocked.api.GET(blocked.request('GET',{headers:new Headers({Authorization:`Bearer ${token}`})}))).status,429);assert.deepEqual(blocked.effects,['limit']);
});
