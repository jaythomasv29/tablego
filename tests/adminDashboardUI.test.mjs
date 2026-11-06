import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {act,create} from 'react-test-renderer';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as service from '../src/lib/reservations/service.ts';
const host=tag=>({children,...props})=>React.createElement(tag,props,children);
const exported=value=>({__esModule:true,default:value});
function load(path,imports,globals={}) {
  const file=new URL(`../src/${path}`,import.meta.url),require=createRequire(file),module={exports:{}};
  runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:name=>imports[name]||(name.endsWith('.css')?exported({}):require(name)),...globals});return module.exports;
}
test('service metrics distinguish confirmed guests, pending requests and seated parties in restaurant local time',async t=>{
  const Summary=load('components/service/TodaySummary.tsx',{'@/lib/reservations/service':service}).default;
  const bookings=[['confirmed',4],['pending',3],['seated',2],['completed',5],['cancelled',10]].map(([status,guests],i)=>service.serviceReservation(String(i),{name:'Test',date:'2026-11-06',time:'7:00 PM',status,guests},'America/Los_Angeles'));
  bookings.push(service.serviceReservation('other-day',{name:'Tomorrow',date:'2026-11-07',time:'7:00 PM',status:'confirmed',guests:12},'America/Los_Angeles'));
  let r;await act(async()=>{r=create(React.createElement(Summary,{bookings,timezone:'America/Los_Angeles',now:new Date('2026-11-06T20:00:00Z')}));});t.after(()=>act(()=>r.unmount()));
  const cards=r.root.findByType('section').findAllByType('strong');
  assert.deepEqual(cards.map(c=>c.children.join('')),['11','1','1','1']);
  assert.ok(r.root.findAllByType('p').some(p=>p.children.join('')==='3 guests requested'));
});
test('admin navigation exposes frequent touch destinations and refresh retains inventory drafts',async t=>{
  const store=new Map([['tablego-inline-stock:2026-11-06:basil','unsaved-count']]),themes=[],keys=[];
  let toggles=0,reloads=0;
  const setTheme=value=>themes.push(value);
  const Layout=load('components/AdminLayout.tsx',{
    './AdminSideBar':exported(()=>null),'next/link':exported(host('a')),'next/navigation':{usePathname:()=>'/admin/inventory/check'},
    'next-themes':{useTheme:()=>({setTheme})},'@/components/ui/button':{Button:host('button')},
    '@/components/ui/sidebar':{SidebarProvider:host('provider'),SidebarInset:host('inset'),SidebarTrigger:host('trigger'),useSidebar:()=>({toggleSidebar:()=>toggles++,openMobile:false})},
    'firebase/auth':{signOut:async()=>{}},'@/firebase':{auth:{}},'@/utils/soundUtils':{unlockAudio(){}},
  },{window:{addEventListener:(type,callback)=>{if(type==='keydown')keys.push(callback);},removeEventListener(){},location:{reload:()=>reloads++}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),clear:()=>{throw new Error('Must retain drafts');}}}).default;
  let r;await act(async()=>{r=create(React.createElement(Layout,null,'Dashboard'));});t.after(()=>act(()=>r.unmount()));
  assert.equal(r.root.findByType('provider').props.mobileBreakpoint,1024);
  const nav=r.root.findByProps({'aria-label':'Quick navigation'});
  assert.equal(nav.findAllByType('a').length,4);
  assert.equal(nav.findAllByProps({'aria-current':'page'})[0].props.href,'/admin/inventory/manage');
  await act(async()=>nav.findByType('button').props.onClick());assert.equal(toggles,1);
  const button=text=>r.root.findAllByType('button').find(b=>b.children.some(c=>c===text));
  await act(async()=>button('Light').props.onClick());
  assert.equal(r.root.findByType('provider').props['data-admin-appearance'],'light');
  assert.equal(themes.at(-1),'light');
  await act(async()=>button('Refresh').props.onClick());
  assert.equal(reloads,1);assert.equal(store.get('tablego-inline-stock:2026-11-06:basil'),'unsaved-count');
});
