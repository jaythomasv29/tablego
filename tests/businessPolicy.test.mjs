import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import { automaticConfirmation } from '../src/lib/reservations/domain.ts';
test('booking policy recovers after settings repair without clearing another source failure', () => {
 const filename = new URL('../src/components/reservations/useBusinessPolicy.ts', import.meta.url);
 const module = { exports: {} }, normalRequire = createRequire(filename), listeners = new Map();
 const compiled = ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 runInNewContext(compiled,{module,exports:module.exports,require:name=> {
  if(name==='firebase/firestore') return { doc:(_db,_collection,id)=>id,collection:()=> 'dates',onSnapshot:(id,callback,error)=> { listeners.set(id,{callback,error});return ()=>listeners.delete(id); } };
  if(name==='@/firebase') return {db:{}};
  if(name==='@/contexts/TimezoneContext') return {useTimezone:()=>({timezone:'America/Los_Angeles',loading:false,error:''})};
  if(name==='@/lib/reservations/domain') return {automaticConfirmation};
  return normalRequire(name);
 }});
 let policy, renderer;
 function Probe(){policy=module.exports.useBusinessPolicy();return null;}
 act(()=>{renderer=create(React.createElement(Probe));});
 const general=value=>act(()=>listeners.get('general').callback({data:()=>value}));
 const hours=exists=>act(()=>listeners.get('businessHours').callback({exists:()=>exists,data:()=>({synthetic:true})}));
 hours(true); act(()=>listeners.get('dates').callback({docs:[]}));general({});
 assert.equal(policy.policy.autoConfirmReservations,true);
 general({autoConfirmReservations:'false'}); assert.equal(policy.policy,null);assert.ok(policy.error);
 general({autoConfirmReservations:false}); assert.equal(policy.policy.autoConfirmReservations,false);assert.equal(policy.error,'');
 hours(false); general({autoConfirmReservations:true}); assert.equal(policy.policy,null);assert.ok(policy.error);
 hours(true); assert.equal(policy.error,'');assert.equal(policy.policy.autoConfirmReservations,true);
 act(()=>renderer.unmount());
});
