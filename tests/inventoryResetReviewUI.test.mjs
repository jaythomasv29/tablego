import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {act,create} from 'react-test-renderer';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const file=new URL('../src/components/inventory/InventoryResetReview.tsx',import.meta.url),require=createRequire(file);
async function mount(t,{pending=false,fail=false}={}){
 const module={exports:{}},calls=[],saved=[];let attempts=0;
 runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,crypto:{randomUUID:()=> 'reset-one'},fetch:async(_,options)=>{calls.push(options);if(fail&&++attempts===1)throw new Error('Lost response');return{ok:true,json:async()=>({stock:{basil:{version:3,checkedOn:''}}})};},require:name=>name==='./InventoryQuickReviewProvider'?{useInventoryQuickReview:()=>({entries:pending?[{}]:[]})}:name==='@/components/ui/dialog'?{Dialog:({open,children})=>open?children:null,DialogContent:({children})=>React.createElement('div',{},children),DialogTitle:({children})=>React.createElement('h2',{},children),DialogDescription:({children})=>React.createElement('p',{},children)}:require(name)});
 let r;await act(async()=>{r=create(React.createElement(module.exports.default,{stock:{basil:{version:2}},date:'2026-11-11',onReset:board=>saved.push(board)}));});t.after(()=>act(()=>r.unmount()));
 const button=text=>r.root.findAllByType('button').find(b=>b.children.join('')===text);
 return{r,calls,saved,button};
}
test('reset requires explicit confirmation, keeps the request ID on uncertain retry, and returns refreshed stock',async t=>{
 const f=await mount(t,{fail:true});
 await act(async()=>f.button('Reset inventory check').props.onClick());assert.equal(f.calls.length,0);
 await act(async()=>f.button('Reset and start again').props.onClick());assert.equal(f.saved.length,0);
 await act(async()=>f.button('Retry reset').props.onClick());assert.equal(f.saved.length,1);
 assert.equal(f.calls[0].body,f.calls[1].body);
 const payload=JSON.parse(f.calls[0].body);assert.equal(payload.action,'resetReview');assert.equal(payload.versions.basil,2);
});
test('reset cannot start while background choices remain unsynced',async t=>{
 const f=await mount(t,{pending:true});assert.equal(f.button('Reset inventory check').props.disabled,true);assert.equal(f.calls.length,0);
});
