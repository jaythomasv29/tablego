'use client';
import { useEffect, useRef, useState } from 'react';
import type { CatalogGood, OperationsBoard, PurchaseOrder, SupplierOffer } from '@/lib/inventory/operations';
import { groupInventoryOrder, inventoryOrderSectionsText, inventoryUnitOptions } from '@/lib/inventory/model';
import {useInventoryQuickReview} from './InventoryQuickReviewProvider';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import styles from './InventoryOrderList.module.css';
export type OrderRequestRow = { good: CatalogGood; quantity?: number; unit: string; offer?: SupplierOffer; choices: SupplierOffer[] };
export function orderRequestRows(board: OperationsBoard, selected: Record<string,string> = {}): OrderRequestRow[] {
 return board.goods.filter(g=>board.stock[g.id]?.orderOpen).map(good=>{
 const item=board.stock[good.id],choices=board.offers.filter(o=>o.itemId===good.id),preferred=choices.filter(o=>o.preferred);
 const offer=choices.find(o=>o.id===selected[good.id]) || (preferred.length===1?preferred[0]:choices.length===1?choices[0]:undefined);
 return {good,quantity:item.orderQuantity,unit:item.orderUnit||item.unit,offer,choices};
 });
}
export type OrderSection={name:string;rows:OrderRequestRow[]};
export function orderSections(rows:OrderRequestRow[],goods:CatalogGood[]=rows.map(r=>r.good)):OrderSection[]{return groupInventoryOrder(rows,r=>r.good,goods).map(s=>({name:s.name,rows:s.items}));}
export function copyOrderSections(sections:OrderSection[]){return inventoryOrderSectionsText(sections.map(s=>({name:s.name,items:s.rows.map(r=>r.good)})));}
export function copyOrderRequests(rows: OrderRequestRow[]) {return rows.map(row=>`• ${row.offer?.supplierItemName||row.good.name}${row.offer?.sku?` [${row.offer.sku}]`:''}`).join('\n');}
export function orderListCounts(board:OperationsBoard){return {requests:board.goods.filter(g=>board.stock[g.id]?.orderOpen).length,arriving:board.orders.filter(o=>o.status!=='received').length,history:board.orders.filter(o=>o.status==='received').length};}
export function orderRequestPayload(board:OperationsBoard,id:string,decision:'order'|'cancelOrder',quantity:string,unit:string,requestId:string){
 const base={action:'checkItem' as const,decision,itemId:id,date:board.today,version:board.stock[id]?.version||0,requestId};
 if(decision==='cancelOrder')return base;
 const n=Number(quantity);if(!quantity.trim()||!Number.isFinite(n)||n<=0||n>999999||Math.round(n*100)/100!==n)throw new Error('Enter an amount to buy greater than zero, with up to two decimals.');
 if(!unit.trim())throw new Error('Choose an ordering unit.');
 return {...base,orderQuantity:n,orderUnit:unit.trim()};
}
type Drafts=Record<string,{quantity:string;unit:string}>;
type Pending=Record<string,{signature:string;payload:ReturnType<typeof orderRequestPayload>}>;
export function orderRequestSignature(payload:ReturnType<typeof orderRequestPayload>){return JSON.stringify({itemId:payload.itemId,decision:payload.decision,...('orderQuantity'in payload?{orderQuantity:payload.orderQuantity,orderUnit:payload.orderUnit}:{})});}
export function restoreOrderListDrafts(raw:string,board:OperationsBoard):{drafts:Drafts;selection:Record<string,string>;pending:Pending}{
 const result:{drafts:Drafts;selection:Record<string,string>;pending:Pending}={drafts:{},selection:{},pending:{}};
 try{const saved=JSON.parse(raw);if(!saved||typeof saved!=='object')return result;
 for(const good of board.goods){const id=good.id,d=saved.drafts?.[id];if(d&&typeof d.quantity==='string'&&d.quantity.length<=20&&typeof d.unit==='string'&&d.unit.length<=24)result.drafts[id]={quantity:d.quantity,unit:d.unit};
 const selected=saved.selection?.[id];if(typeof selected==='string'&&board.offers.some(o=>o.id===selected&&o.itemId===id))result.selection[id]=selected;
 const value=saved.pending?.[id],p=value?.payload;
 if(p&&p.itemId===id&&p.date===board.today&&typeof p.requestId==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(p.requestId)&&Number.isInteger(p.version)&&p.version>=0&&['order','cancelOrder'].includes(p.decision)){
 const candidate=orderRequestPayload({...board,stock:{...board.stock,[id]:{...board.stock[id],version:p.version}}},id,p.decision,String(p.orderQuantity??''),String(p.orderUnit??''),p.requestId);
 result.pending[id]={signature:orderRequestSignature(candidate),payload:candidate};}
 }
 }catch{return result;}return result;
}
export function orderRowsDirty(rows:OrderRequestRow[],drafts:Drafts){return rows.some(row=>{const draft=drafts[row.good.id];return draft&&(draft.quantity!==String(row.quantity??'')||draft.unit!==row.unit);});}
type Props={board:OperationsBoard;onSaved:(board:OperationsBoard)=>void;onBuildOrder:(supplierId?:string)=>void;onLinkSupplier:(good:CatalogGood)=>void;onReceive:(order:PurchaseOrder)=>void;onLoadOlder:()=>void;loadingOlder?:boolean;hasOlder?:boolean};
export default function InventoryOrderList({board,onSaved,onBuildOrder,onLinkSupplier,onReceive,onLoadOlder,loadingOlder,hasOlder}:Props){
 const quick=useInventoryQuickReview();
 const [clearOpen,setClearOpen]=useState(false);
 const [tab,setTab]=useState<'requests'|'arriving'|'history'>('requests'),[selection,setSelection]=useState<Record<string,string>>({}),[drafts,setDrafts]=useState<Record<string,{quantity:string;unit:string}>>({}),[busy,setBusy]=useState(''),[feedback,setFeedback]=useState(''),[error,setError]=useState('');
 const [restored,setRestored]=useState(''),[conflict,setConflict]=useState(false),[storageWarning,setStorageWarning]=useState('');
 const storageKey=`tablego-order-list:${board.today}`;
 const [canShare,setCanShare]=useState(false);useEffect(()=>{setCanShare(typeof navigator.share==='function');},[]);
 const pending=useRef<Pending>({}),lock=useRef(false);
 useEffect(()=>{try{const value=restoreOrderListDrafts(localStorage.getItem(storageKey)||'{}',board);setDrafts(value.drafts);setSelection(value.selection);pending.current=value.pending;}catch{setStorageWarning('This browser cannot keep unfinished order edits. Save before leaving.');}setRestored(storageKey);},[storageKey]); // eslint-disable-line react-hooks/exhaustive-deps
 function persist(nextDrafts=drafts,nextSelection=selection){try{localStorage.setItem(storageKey,JSON.stringify({drafts:nextDrafts,selection:nextSelection,pending:pending.current}));window.dispatchEvent(new Event('tablego-inventory-drafts'));}catch{setStorageWarning('Unfinished order edits could not be stored. Save before leaving.');}}
 useEffect(()=>{if(restored===storageKey)persist();},[drafts,selection,restored]); // eslint-disable-line react-hooks/exhaustive-deps
 const counts=orderListCounts(board),rows=orderRequestRows(board,selection),sections=orderSections(rows,board.goods),groups=Array.from(new Set(rows.map(r=>r.offer?.supplierId||'unassigned'))),units=inventoryUnitOptions(board.customUnits);
 async function copy(values:OrderRequestRow[]|string,share=false){setError('');try{const text=typeof values==='string'?values:copyOrderRequests(values);if(share&&navigator.share)await navigator.share({title:'Order list',text});else await navigator.clipboard.writeText(text);setFeedback(share?'Order list shared':'Order list copied');}catch(e){if((e as Error).name!=='AbortError')setError('Unable to copy this list. Please try again.');}}
 async function save(row:OrderRequestRow,decision:'order'|'cancelOrder'){
 if(lock.current)return;setError('');setFeedback('');
 try{
 if(quick&&!pending.current[row.good.id]){
  const draft=drafts[row.good.id]||{quantity:String(row.quantity??''),unit:row.unit};
  const candidate=orderRequestPayload(board,row.good.id,decision,draft.quantity,draft.unit,crypto.randomUUID());
  quick.enqueue(candidate,row.good.name);
  const next={...drafts};delete next[row.good.id];setDrafts(next);persist(next);
  setFeedback(decision==='cancelOrder'?'Removed from To order · Syncing in background.':'Order amount kept on this device · Syncing in background.');
  return;
 }
 const draft=drafts[row.good.id]||{quantity:String(row.quantity??''),unit:row.unit};const candidate=orderRequestPayload(board,row.good.id,decision,draft.quantity,draft.unit,'pending');const signature=orderRequestSignature(candidate);let request=pending.current[row.good.id];if(!request||request.signature!==signature)request=pending.current[row.good.id]={signature,payload:{...candidate,requestId:crypto.randomUUID()}};
 persist();lock.current=true;setBusy(row.good.id);const response=await fetch('/api/staff/inventory/operations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request.payload)}),result=await response.json();if(!response.ok){if(response.status===409){setConflict(true);delete pending.current[row.good.id];persist();}throw new Error(result.error||'Unable to save request.');}delete pending.current[row.good.id];const nextDrafts={...drafts};delete nextDrafts[row.good.id];persist(nextDrafts);setDrafts(nextDrafts);onSaved(result);setFeedback(decision==='order'?'Requested amount saved. No supplier order sent.':'Removed internal request. Placed supplier orders are unchanged.');
 }catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy('');}}
 function clearRequests(){
  if(lock.current)return;setError('');
  if(!quick){setError('Quick saving is not ready. Reload and try again.');return;}
  let cleared=0;
  try{
   // Each removal is durable before the list changes; requests serialize behind any pending add.
   for(const row of rows){
    quick.enqueue({action:'checkItem',requestId:crypto.randomUUID(),itemId:row.good.id,version:board.stock[row.good.id]?.version||0,date:board.today,decision:'cancelOrder'},row.good.name);
    cleared++;
   }
   setClearOpen(false);setFeedback('To order cleared on this device · Syncing in background.');
  }catch(e){setError(`${cleared?`${cleared} removals queued. `:''}${(e as Error).message} Remaining items are still on the list.`);}
 }
 function orderCard(order:PurchaseOrder){const age=Math.max(0,Math.floor((new Date(`${board.today}T12:00:00Z`).getTime()-new Date(order.orderedAt).getTime())/86400000)),receipts=board.receipts.filter(r=>r.orderId===order.id);return <article key={order.id} className={styles.order}><div className={styles.heading}><strong>{order.supplierName}</strong><span>{order.status==='partial'?`Partial · ${age} day${age===1?'':'s'} since order`:order.status==='received'?'Received':`Placed · ${age} day${age===1?'':'s'} ago`}</span></div><details><summary>{order.lines.length} item{order.lines.length===1?'':'s'} · View details</summary><ul>{order.lines.map(line=><li key={line.itemId}>{line.supplierItemName||line.name} — {line.quantity} {line.unit}{order.status!=='received'&&<strong> · {Math.max(0,Math.round((line.quantity-line.receivedQuantity)*100)/100)} remaining</strong>}</li>)}</ul>{receipts.map(receipt=><p key={receipt.id}>Received by {receipt.by} · {new Date(receipt.at).toLocaleDateString('en-US',{timeZone:board.timezone})}{receipt.note?` · ${receipt.note}`:''}{receipt.lines.filter(l=>l.note||l.damagedQuantity).map(l=>` · ${l.note||''}${l.damagedQuantity?` Damaged: ${l.damagedQuantity}`:''}`).join('')}</p>)}<small>Receiving records deliveries; on-hand counts stay unchanged.</small></details>{order.status!=='received'&&<button onClick={()=>onReceive(order)}>Receive delivery</button>}</article>;}
 return <section className={styles.body} aria-label="Order list"><nav className={styles.tabs} aria-label="Order stages">{([['requests',`To order (${counts.requests})`],['arriving',`Placed / arriving (${counts.arriving})`],['history',`History (${counts.history})`]] as const).map(([value,label])=><button key={value} aria-pressed={tab===value} disabled={!!busy} onClick={()=>setTab(value)}>{label}</button>)}</nav>
 {error&&<p role="alert" className={styles.error}>{error}</p>}{storageWarning&&<p role="alert">{storageWarning}</p>}{Object.keys(drafts).length>0&&<p className={styles.note}>Optional purchasing edits are kept on this device. Save them before preparing a supplier order.</p>}{conflict&&<button disabled={!!busy} onClick={async()=>{if(lock.current)return;lock.current=true;setBusy('refresh');try{const response=await fetch('/api/staff/inventory/operations',{cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to refresh');onSaved(result);setConflict(false);setFeedback('Latest requests loaded. Your edits are still here; review and save again.');}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy('');}}}>Refresh latest requests</button>}{feedback&&<p role="status">{feedback}</p>}
 {tab==='requests'?<>
 <div className={styles.listBar}><strong>{rows.length} item{rows.length===1?'':'s'}</strong><button className={styles.copyAll} disabled={!restored||!!busy||!rows.length} onClick={()=>void copy(copyOrderSections(sections))}>Copy all</button>{canShare&&<button disabled={!restored||!!busy||!rows.length} onClick={()=>void copy(copyOrderSections(sections),true)}>Share list</button>}<button disabled={!restored||!!busy||!rows.length||Object.keys(pending.current).length>0} onClick={()=>setClearOpen(true)}>Clear order list</button></div>
 {!rows.length&&<div className={styles.empty}><strong>Nothing on your shopping list yet</strong><p>Tap Order on an item while checking stock and it lands here, grouped for copying.</p></div>}
 {sections.map(section=><section key={section.name} className={styles.section} aria-label={section.name}><div className={styles.sectionHead}><h3>{section.name} <small>{section.rows.length}</small></h3><button disabled={!restored||!!busy} onClick={()=>void copy(copyOrderSections([section]))}>Copy</button></div><ul className={styles.list}>{section.rows.map(row=><li key={row.good.id}><span className={styles.itemName}>{row.good.name}{row.good.detail&&<small>{row.good.detail}</small>}</span><button className={styles.remove} aria-label={`Remove ${row.good.name} from To order`} disabled={!restored||!!busy} onClick={()=>void save(row,'cancelOrder')}>Remove</button></li>)}</ul></section>)}
 {rows.length>0&&<details className={styles.supplierTools}><summary>Supplier ordering (optional)</summary><p className={styles.note}>Link supplier products, set amounts and prepare a supplier order. Nothing is sent automatically.</p>
 {groups.map(group=>{const values=rows.filter(r=>(r.offer?.supplierId||'unassigned')===group),supplier=board.suppliers.find(s=>s.id===group);return <section key={group} className={styles.group}><div className={styles.heading}><h3>{supplier?.name||values[0]?.offer?.supplierName||'Choose supplier / not linked'} <small>({values.length})</small></h3><button disabled={!!busy} onClick={()=>void copy(values)}>Copy group</button></div>{values.map(row=>{const draft=drafts[row.good.id]||{quantity:String(row.quantity??''),unit:row.unit};return <article key={row.good.id} className={styles.row}><div className={styles.name}><strong>{row.good.name}</strong>{row.offer&&<small>{row.offer.supplierItemName}{row.offer.sku?` · ${row.offer.sku}`:''}</small>}{!row.offer&&<small>{row.choices.length?'Choose which supplier item to use':'No supplier item linked yet'}</small>}</div>{row.choices.length>1&&<label className={styles.supplier}>Supplier item<select disabled={!restored||!!busy} aria-label={`Supplier for ${row.good.name}`} value={selection[row.good.id]||row.offer?.id||''} onChange={e=>setSelection(old=>({...old,[row.good.id]:e.target.value}))}><option value="">Choose supplier</option>{row.choices.map(offer=><option key={offer.id} value={offer.id}>{offer.supplierName} · {offer.supplierItemName}</option>)}</select></label>}<div className={styles.edit}><label>To buy<input disabled={!restored||!!busy} aria-label={`Amount to buy for ${row.good.name}`} type="number" min="0.01" max="999999" step="0.01" inputMode="decimal" value={draft.quantity} onChange={e=>setDrafts(old=>({...old,[row.good.id]:{...draft,quantity:e.target.value}}))}/></label><label>Unit<select disabled={!restored||!!busy} aria-label={`Ordering unit for ${row.good.name}`} value={draft.unit} onChange={e=>setDrafts(old=>({...old,[row.good.id]:{...draft,unit:e.target.value}}))}>{Array.from(new Set([...units,draft.unit])).map(unit=><option key={unit}>{unit}</option>)}</select></label><button disabled={!restored||!!busy} onClick={()=>void save(row,'order')}>{busy===row.good.id?'Saving…':'Save'}</button></div>{!row.offer&&<button disabled={!!busy} className={styles.link} onClick={()=>onLinkSupplier(row.good)}>Link supplier</button>}</article>;})}{group!=='unassigned'&&<button disabled={!!busy||orderRowsDirty(values,drafts)} onClick={()=>onBuildOrder(group)}>Prepare order for {supplier?.name||'supplier'}</button>}</section>;})}
 </details>}
 {!rows.length&&<button className={styles.link} onClick={()=>onBuildOrder()}>Prepare supplier order</button>}</>:tab==='arriving'?<>{!counts.arriving&&<p className={styles.empty}>No placed orders awaiting delivery. Your shopping requests are under To order.</p>}{board.orders.filter(o=>o.status!=='received').map(orderCard)}</>:<>{!counts.history&&<p className={styles.empty}>No received orders in this view.</p>}{board.orders.filter(o=>o.status==='received').map(orderCard)}</>}
 <Dialog open={clearOpen} onOpenChange={setClearOpen}><DialogContent><DialogTitle>Clear To order?</DialogTitle><DialogDescription>Remove all {rows.length} items from the To order list, across all categories and suppliers. Stock amounts, inventory review progress, purchasing drafts and placed supplier orders stay saved. This applies to everyone using Inventory after syncing.</DialogDescription>{error&&<p role="alert">{error}</p>}<div className={styles.actions}><button onClick={()=>setClearOpen(false)}>Keep order list</button><button disabled={!!busy||!rows.length} onClick={clearRequests}>Clear To order</button></div></DialogContent></Dialog>
 {tab!=='requests'&&hasOlder&&<button disabled={loadingOlder} onClick={onLoadOlder}>{loadingOlder?'Loading…':'Load older orders'}</button>}</section>;
}
