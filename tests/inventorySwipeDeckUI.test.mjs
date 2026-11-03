import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {act,create} from 'react-test-renderer';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const file=new URL('../src/components/inventory/InventorySwipeDeck.tsx',import.meta.url), normalRequire=createRequire(file);
const goods=[{id:'basil',name:'Basil',category:'Produce',baseUnit:'lb'},{id:'rice',name:'Rice',category:'Pantry',baseUnit:'bag'},{id:'lime',name:'Limes',category:'Produce',baseUnit:'bag'}];
const board={goods,stock:{},customUnits:[],today:'2026-11-03',timezone:'America/Los_Angeles'};
async function mount(t,{compact=false,reduced=false}={}) {
  const module={exports:{}}, actions=[], animations=[];
  const Inline=props=>{
    React.useImperativeHandle(props.controls,()=>({order:()=>actions.push('order'),recheck:()=>actions.push('sufficient')}));
    React.useEffect(()=>props.onInteractionChange(false),[props.onInteractionChange]);
    return React.createElement('stock-form',props);
  };
  runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,require:name=>{
    if(name==='./InlineStockCheck')return {__esModule:true,default:Inline};
    if(name==='framer-motion')return {motion:{article:'motion-card',span:'motion-span'},useAnimationControls:()=>React.useMemo(()=>({start:async value=>animations.push(value),set(){}}),[]),useMotionValue:()=>React.useMemo(()=>({set(){}}),[]),useReducedMotion:()=>reduced,useTransform:()=>0,useDragControls:()=>({start(){}})};
    if(name==='lucide-react')return Object.fromEntries(['ArrowLeft','ArrowRight','CheckCircle2','Layers'].map(n=>[n,()=>null]));
    if(name==='@/lib/inventory/model')return {inventoryChecked:(s,d)=>s?.checkedOn===d,inventoryUnitOptions:u=>u};
    if(name.endsWith('.css'))return {__esModule:true,default:{}};
    return normalRequire(name);
  }});
  const Component=compact?module.exports.SwipeStockCard:module.exports.default;
  let r;const props={board,goods,good:goods[0],compact,onSaved(){},onDraftChange(){}};
  await act(async()=>{r=create(React.createElement(Component,props));});
  t.after(()=>act(()=>r.unmount()));
  return {r,actions,animations,update:next=>act(async()=>r.update(React.createElement(Component,{...props,...next})))};
}
test('deck keeps category order, ignores short/vertical gestures and advances only after confirmed decisions',async t=>{
  const {r,actions,update}=await mount(t);
  const drag=info=>r.root.findByType('motion-card').props.onDragEnd(null,info);
  await act(async()=>drag({offset:{x:40,y:0}}));
  await act(async()=>drag({offset:{x:-100,y:140}}));
  assert.deepEqual(actions,[]);
  await act(async()=>drag({offset:{x:110,y:0}}));
  assert.deepEqual(actions,['order']);
  assert.equal(r.root.findByType('stock-form').props.good.id,'basil');
  // A refresh/filter can remove the active item, but must not bypass its save animation.
  await update({goods:goods.slice(1),board:{...board,stock:{basil:{checkedOn:board.today}}}});
  assert.equal(r.root.findByType('stock-form').props.good.id,'basil');
  await act(async()=>r.root.findByType('stock-form').props.onCommitted('order'));
  assert.equal(r.root.findByType('stock-form').props.good.id,'lime');
  assert.equal(r.root.findByType('progress').props.value,1);
  assert.equal(r.root.findByType('progress').props.max,3);
  await act(async()=>r.root.findByType('stock-form').props.onCommitted('sufficient'));
  assert.equal(r.root.findByType('stock-form').props.good.id,'rice');
});
test('multi-card swipes reuse the same actions, remain visible after saving and honor reduced motion',async t=>{
  const {r,actions,animations}=await mount(t,{compact:true,reduced:true});
  await act(async()=>r.root.findByType('motion-card').props.onDragEnd(null,{offset:{x:-120,y:0}}));
  assert.deepEqual(actions,['sufficient']);
  await act(async()=>r.root.findByType('stock-form').props.onCommitted('sufficient'));
  assert.equal(r.root.findByType('stock-form').props.good.id,'basil');
  assert.equal(animations[0].x,0);
  await act(async()=>r.root.findByType('stock-form').props.onInteractionChange(true));
  assert.equal(r.root.findByType('motion-card').props.drag,false);
});
