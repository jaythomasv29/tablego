import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {act,create} from 'react-test-renderer';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {overlayQuickReviews} from '../src/lib/inventory/quickReviewQueue.ts';
import * as model from '../src/lib/inventory/model.ts';
const file=new URL('../src/components/inventory/InventoryOrderList.tsx',import.meta.url),require=createRequire(file);
async function mount(t,{fail=false}={}){
 const module={exports:{}},queued=[],calls=[];let quick,sequence=0;
 const day='2026-11-11',board={today:day,timezone:'America/Los_Angeles',goods:[{id:'basil',name:'Basil'},{id:'corn',name:'Corn'}],stock:{basil:{version:1,quantity:4,unit:'bag',orderOpen:true},corn:{version:2,quantity:3,unit:'lb',orderOpen:true}},offers:[],suppliers:[],orders:[],receipts:[],customUnits:[]};
 runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,Date,Event:class{},navigator:{},crypto:{randomUUID:()=>`id-${++sequence}`},window:{dispatchEvent(){}},localStorage:{getItem:()=>null,setItem(){}},fetch:async(...args)=>{calls.push(args);throw new Error('network must not be needed')},require:name=>name==='./InventoryQuickReviewProvider'?{useInventoryQuickReview:()=>quick}:name==='@/lib/inventory/model'?{...model,inventoryUnitOptions:()=>['bag','lb']}:name==='@/components/ui/dialog'?{Dialog:({open,children})=>open?children:null,DialogContent:({children})=>React.createElement('div',{},children),DialogTitle:({children})=>React.createElement('h2',{},children),DialogDescription:({children})=>React.createElement('p',{},children)}:name.endsWith('.css')?{default:{}}:require(name)});
 function Harness(){const[entries,setEntries]=React.useState([]);quick={entries,enqueue:(payload,name)=>{if(fail)throw new Error('Storage full');queued.push(payload);setEntries(old=>[...old,{payload,name,at:day+'T18:00:00Z',state:'queued'}]);}};return React.createElement(module.exports.default,{board:{...board,stock:overlayQuickReviews(board.stock,day,entries)},onSaved(){},onBuildOrder(){},onLinkSupplier(){},onReceive(){},onLoadOlder(){}});}
 let r;await act(async()=>{r=create(React.createElement(Harness));});t.after(()=>act(()=>r.unmount()));
 const buttons=text=>r.root.findAllByType('button').filter(b=>b.children.join('')===text);
 return{r,queued,calls,buttons};
}
test('Remove disappears immediately and leaves the next item actionable before any network response',async t=>{
 const f=await mount(t);assert.equal(f.buttons('Remove').length,2);
 await act(async()=>f.buttons('Remove')[0].props.onClick());
 assert.equal(f.buttons('Remove').length,1);assert.equal(f.buttons('Remove')[0].props.disabled,false);assert.equal(f.calls.length,0);assert.equal(f.queued[0].decision,'cancelOrder');
});
test('Clear order list requires confirmation and queues every removal immediately',async t=>{
 const f=await mount(t);await act(async()=>f.buttons('Clear order list')[0].props.onClick());assert.equal(f.queued.length,0);
 await act(async()=>f.buttons('Clear To order')[0].props.onClick());
 assert.equal(f.buttons('Remove').length,0);assert.equal(f.queued.length,2);assert.equal(f.calls.length,0);assert.ok(f.queued.every(p=>p.decision==='cancelOrder'&&!('quantity'in p)));
});
test('storage failure keeps requests visible and reports the problem',async t=>{
 const f=await mount(t,{fail:true});await act(async()=>f.buttons('Remove')[0].props.onClick());assert.equal(f.buttons('Remove').length,2);assert.equal(f.queued.length,0);assert.match(f.r.root.findByProps({role:'alert'}).children.join(''),/Storage full/);
});
