import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuickReviewQueue,overlayQuickReviews,quickReviewKey} from '../src/lib/inventory/quickReviewQueue.ts';
const turn=()=>new Promise(setImmediate);
const day='2026-11-08';
const payload=(id,item='basil',decision='order')=>({action:'checkItem',requestId:id,itemId:item,version:0,date:day,decision,...(decision==='order'?{flagOnly:true}:{})});
function fixture(existing=new Map()){
 let entries=[],seq=0;const calls=[],saved=[];
 const storage={get length(){return existing.size},key:i=>[...existing.keys()][i]??null,getItem:k=>existing.get(k)??null,setItem:(k,v)=>existing.set(k,v),removeItem:k=>existing.delete(k)};
 const deps={storage,uuid:()=>`new-${++seq}`,now:()=>day+'T18:00:00Z',onChange:e=>entries=e,onSaved:b=>saved.push(b),latest:async()=>({today:day,stock:{basil:{version:8}}}),send:p=>new Promise((resolve,reject)=>calls.push({payload:structuredClone(p),resolve,reject}))};
 const queue=createQuickReviewQueue(deps);queue.start();
 return {queue,deps,calls,saved,existing,get entries(){return entries}};
}
function success(call,version=1){call.resolve({ok:true,status:200,json:async()=>({today:day,stock:{[call.payload.itemId]:{version}}})});}
test('choice appears and is durable before the server responds; acknowledged choice leaves queue',async()=>{
 const f=fixture();f.queue.enqueue(payload('one'),'Basil');
 assert.equal(f.calls.length,1);assert.equal(f.entries[0].state,'saving');assert.ok(f.existing.has(quickReviewKey+':one'));
 const stock=overlayQuickReviews({},day,f.entries);assert.equal(stock.basil.orderOpen,true);assert.equal(stock.basil.quantity,null);assert.equal(stock.basil.checkedBy,'This device · syncing');
 success(f.calls[0]);await turn();assert.equal(f.entries.length,0);assert.equal(f.existing.size,0);assert.equal(f.saved.length,1);
});
test('same-item choices serialize and rebase only after own acknowledgment; other items run concurrently',async()=>{
 const f=fixture();f.queue.enqueue(payload('one'),'Basil');f.queue.enqueue(payload('two','basil','sufficient'),'Basil');f.queue.enqueue(payload('corn','corn'),'Corn');
 assert.equal(f.calls.length,2);assert.equal(overlayQuickReviews({},day,f.entries).basil.decision,'sufficient');
 success(f.calls[0],1);await turn();assert.equal(f.calls.length,3);assert.equal(f.calls[2].payload.version,1);assert.equal(f.calls[2].payload.requestId,'two');
});
test('interrupted request remains visible and retry uses the identical frozen payload',async()=>{
 const f=fixture();f.queue.enqueue(payload('one'),'Basil');f.calls[0].reject(new Error('offline'));await turn();assert.equal(f.entries[0].state,'failed');
 await f.queue.retry();assert.deepEqual(f.calls[1].payload,f.calls[0].payload);success(f.calls[1]);await turn();assert.equal(f.entries.length,0);
});
test('refresh resumes original durable request and an old unmounted worker cannot overwrite new choices',async()=>{
 const first=fixture();first.queue.enqueue(payload('one'),'Basil');first.queue.stop();
 const next=fixture(first.existing);assert.deepEqual(next.calls[0].payload,first.calls[0].payload);next.queue.enqueue(payload('two','corn'),'Corn');
 success(first.calls[0]);await turn();assert.ok(next.existing.has(quickReviewKey+':two'));assert.equal(first.saved.length,0);
});
test('storage failure rejects before advancing or sending',()=>{
 const f=fixture();f.deps.storage.setItem=()=>{throw new Error('quota')};
 assert.throws(()=>f.queue.enqueue(payload('one'),'Basil'),/quota/);assert.equal(f.calls.length,0);assert.equal(f.entries.length,0);
});
test('conflicts require explicit retry with current version and a new request ID',async()=>{
 const f=fixture();f.queue.enqueue(payload('one'),'Basil');f.calls[0].resolve({ok:false,status:409,json:async()=>({error:'changed'})});await turn();assert.equal(f.entries[0].conflict,true);
 await f.queue.retry(false);assert.equal(f.calls.length,1);
 await f.queue.retry();assert.equal(f.calls[1].payload.version,8);assert.notEqual(f.calls[1].payload.requestId,'one');
});
test('independent tabs keep separate durable keys and cannot erase each other’s newly queued choices',async()=>{
 const shared=new Map(),a=fixture(shared),b=fixture(shared);a.queue.enqueue(payload('a'),'Basil');b.queue.enqueue(payload('b','corn'),'Corn');
 success(a.calls[0]);await turn();assert.ok(shared.has(quickReviewKey+':b'));
});

test('adding a queued choice writes only that choice instead of rewriting the entire backlog',()=>{
 const f=fixture();let writes=0;const original=f.deps.storage.setItem;
 f.deps.storage.setItem=(k,v)=>{writes++;original(k,v)};
 for(let i=0;i<4;i++)f.queue.enqueue(payload('request-'+i,'item-'+i),'Item '+i);
 const before=writes;f.queue.enqueue(payload('last','last'),'Last');assert.equal(writes-before,1);
});

test('rapid retry taps cannot rebase the same in-flight choice twice',async()=>{
 const f=fixture();let reads=0;f.deps.latest=async()=>{reads++;return {today:day,stock:{basil:{version:4}}}};
 f.queue.enqueue(payload('one'),'Basil');f.calls[0].resolve({ok:false,status:409,json:async()=>({error:'changed'})});await turn();
 await Promise.all([f.queue.retry(),f.queue.retry()]);assert.equal(reads,1);assert.equal(f.calls.length,2);
});
