import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {act,create} from 'react-test-renderer';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as dailyStock from '../src/lib/inventory/dailyStock.ts';
const board=dailyStock.dailyStockBoard([{id:'basil',name:'Basil',category:'Produce',baseUnit:'lb'},{id:'melon',name:'Melon',category:'Produce',baseUnit:'each'},{id:'rice',name:'Rice',category:'Pantry',baseUnit:'bag'}],{basil:{quantity:2,unit:'lb',checkedAt:'2026-11-02T19:00:00Z',countedAt:'2026-11-01T19:00:00Z',checkedOn:'2026-11-02',decision:'sufficient'}},'2026-11-02','America/Los_Angeles');
function component(name,imports={},globals={}) {
 const file=new URL(`../src/components/inventory/${name}.tsx`,import.meta.url),require=createRequire(file),module={exports:{}};
 runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,require:name=>name.endsWith('.module.css')?{default:new Proxy({},{get:(_,key)=>key})}:imports[name]||require(name),Date,URL,URLSearchParams,...globals});return module.exports;
}
const view=component('DailyStockView',{'@/lib/inventory/dailyStock':dailyStock});
const button=(r,text)=>r.root.findAllByType('button').find(b=>b.children.filter(child=>typeof child==='string').join('').startsWith(text));
test('daily view shows every category, distinguishes unknown quantity and zero, filters by category/search and can pause dots',async t=>{
 let r;await act(async()=>{r=create(React.createElement(view.default,{board}));});t.after(()=>act(()=>r.unmount()));
 assert.equal(r.root.findAllByType('li').length,3);assert.ok(JSON.stringify(r.toJSON()).includes('Never checked'));assert.ok(JSON.stringify(r.toJSON()).includes('Not counted'));
 assert.ok(JSON.stringify(r.toJSON()).includes('Nov 2, 2026'));assert.ok(JSON.stringify(r.toJSON()).includes('Nov 1, 2026'));
 await act(async()=>button(r,'Pantry').props.onClick());assert.equal(r.root.findAllByType('li').length,1);assert.ok(JSON.stringify(r.toJSON()).includes('Rice'));
 await act(async()=>button(r,'All categories').props.onClick());await act(async()=>r.root.findByType('input').props.onChange({target:{value:'melon'}}));assert.equal(r.root.findAllByType('li').length,1);
 await act(async()=>button(r,'Pause dots').props.onClick());assert.equal(r.root.findAllByProps({'data-animate':false}).length,1);
});
test('modal sharing creates an expiring read-only link with the token in the fragment and preserves it for manual copying',async t=>{
 const calls=[],copies=[];
 const api=component('InventoryDailyStock',{
  '@/components/ui/dialog':{Dialog:({open,children})=>open?React.createElement('dialog',{},children):null,DialogContent:p=>React.createElement('div',p),DialogTitle:p=>React.createElement('h2',p),DialogDescription:p=>React.createElement('p',p)},
  './DailyStockView':{__esModule:true,default:()=>React.createElement('div',{},'Stock rows'),stockDate:view.stockDate},
  './useDailyStock':{useDailyStock:()=>({board,error:'',loading:false,stale:false,refresh:async()=>{}})},
 },{window:{location:{origin:'https://tablego.test'}},navigator:{clipboard:{writeText:async value=>copies.push(value)}},fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({token:'signed-token',expiresAt:'2026-11-09T19:00:00Z'})};}});
 let r;await act(async()=>{r=create(React.createElement(api.default));});t.after(()=>act(()=>r.unmount()));
 await act(async()=>button(r,'Daily stock').props.onClick());await act(async()=>button(r,'Share view').props.onClick());
 assert.equal(calls[0].options.method,'POST');const link=r.root.findByType('input').props.value;assert.equal(link,'https://tablego.test/inventory/daily-stock#token=signed-token');assert.equal(new URL(link).search,'');
 assert.ok(JSON.stringify(r.toJSON()).includes('Nov 9, 2026'));
 await act(async()=>button(r,'Copy link').props.onClick());assert.deepEqual(copies,[link]);
});
