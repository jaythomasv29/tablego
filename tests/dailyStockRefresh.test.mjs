import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {act,create} from 'react-test-renderer';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
test('stock updates on the timer and focus, pauses in hidden tabs, retains stale data on failure and clears expired access', async t=>{
 const file=new URL('../src/components/inventory/useDailyStock.ts',import.meta.url),require=createRequire(file),module={exports:{}},listeners={},calls=[];
 let tick,cleared=false,status=200,serial=0,state;
 const document={visibilityState:'visible',addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:name=>delete listeners[name]};
 const window={setInterval:(fn,ms)=>{assert.equal(ms,30000);tick=fn;return 1;},clearInterval:()=>cleared=true,addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:name=>delete listeners[name]};
 runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,require,document,window,AbortController,fetch:async(url,options)=>{calls.push({url,options});return {ok:status===200,status,json:async()=>status===200?{rows:[{quantity:++serial}]}:{error:'Expired or offline'}};}});
 function Harness(){state=module.exports.useDailyStock(true,'signed-token');return null;}
 let r;await act(async()=>{r=create(React.createElement(Harness));});t.after(()=>{if(r)act(()=>r.unmount());});
 assert.equal(state.board.rows[0].quantity,1);assert.equal(calls[0].options.headers.Authorization,'Bearer signed-token');assert.equal(calls[0].options.cache,'no-store');
 await act(async()=>tick());assert.equal(state.board.rows[0].quantity,2);
 document.visibilityState='hidden';await act(async()=>tick());assert.equal(calls.length,2);
 document.visibilityState='visible';await act(async()=>listeners.visibilitychange());assert.equal(state.board.rows[0].quantity,3);
 status=503;await act(async()=>tick());assert.equal(state.stale,true);assert.equal(state.board.rows[0].quantity,3);
 status=401;await act(async()=>tick());assert.equal(state.board,null);
 await act(async()=>r.unmount());r=null;assert.equal(cleared,true);assert.equal(calls[0].options.signal.aborted,true);assert.deepEqual(Object.keys(listeners),[]);
});
