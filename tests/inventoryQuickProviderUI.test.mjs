import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {act,create} from 'react-test-renderer';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {createQuickReviewQueue} from '../src/lib/inventory/quickReviewQueue.ts';
const file=new URL('../src/components/inventory/InventoryQuickReviewProvider.tsx',import.meta.url),require=createRequire(file);
test('a pending item updates immediately and reports failure without rendering unrelated forms',async t=>{
 const module={exports:{}},storage=new Map(),renders={basil:0,corn:0};let reject,enqueue;
 runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,Date,AbortController,setTimeout,clearTimeout,crypto:{randomUUID:()=> 'retry'},window:{addEventListener(){},removeEventListener(){}},localStorage:{get length(){return storage.size},key:i=>[...storage.keys()][i],getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fetch:()=>new Promise((_,fail)=>{reject=fail}),require:name=>name==='@/lib/inventory/quickReviewQueue'?{createQuickReviewQueue}:name==='@/lib/inventory/progress'?{mergeInventoryBoard:(_,next)=>next}:require(name)});
 const {default:Provider,useInventoryQuickItem}=module.exports;
 function Item({id}){const value=useInventoryQuickItem(id,'2026-11-11');renders[id]++;if(id==='basil')enqueue=value.enqueue;return React.createElement('output',{id},value.entries[0]?.state||'idle');}
 let r;await act(async()=>{r=create(React.createElement(Provider,null,React.createElement(Item,{id:'basil'}),React.createElement(Item,{id:'corn'})));});t.after(()=>act(()=>r.unmount()));
 const before=renders.corn;
 await act(async()=>enqueue({action:'checkItem',requestId:'one',itemId:'basil',date:'2026-11-11',version:0,decision:'sufficient'},'Basil'));
 assert.equal(r.root.findByProps({id:'basil'}).findByType('output').children.join(''),'saving');assert.equal(renders.corn,before);
 await act(async()=>reject(new Error('offline')));
 assert.equal(r.root.findByProps({id:'basil'}).findByType('output').children.join(''),'failed');assert.equal(renders.corn,before);
});
