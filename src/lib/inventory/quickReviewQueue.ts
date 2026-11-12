import type { OperationsBoard } from './operations';
import type { InventoryRecords } from './model';
export type QuickPayload = { action:'checkItem'; requestId:string; itemId:string; version:number; date:string; decision:'order'|'sufficient'|'cancelOrder'; flagOnly?:true; quantity?:number; unit?:string; orderQuantity?:number; orderUnit?:string };
export type QuickEntry = { payload:QuickPayload; name:string; at:string; state:'queued'|'saving'|'failed'; error?:string; conflict?:boolean; attempted?:boolean };
export const quickReviewKey='tablego-quick-reviews:v1';
type Response = {ok:boolean;status:number;json:()=>Promise<OperationsBoard & {error?:string}>};
type Dependencies = {storage:Pick<Storage,'getItem'|'setItem'|'removeItem'|'key'|'length'>; send:(payload:QuickPayload)=>Promise<Response>; latest:()=>Promise<OperationsBoard>; uuid:()=>string; now:()=>string; onChange:(entries:QuickEntry[])=>void; onSaved:(board:OperationsBoard)=>void};
export function createQuickReviewQueue(deps:Dependencies) {
 let entries:QuickEntry[]=[],active=0,started=false,retrying=false;
 const versions=new Map<string,number>();
 const key=(p:QuickPayload)=>`${p.date}:${p.itemId}`;
 const storedIds=new Set<string>();
 const storedValues=new Map<string,string>();
 function persist(next:QuickEntry[]) {
  const ids=new Set(next.map(e=>e.payload.requestId));
  for(const entry of next){const id=entry.payload.requestId,value=JSON.stringify(entry);if(storedValues.get(id)!==value){deps.storage.setItem(`${quickReviewKey}:${id}`,value);storedValues.set(id,value);}storedIds.add(id);}
  for(const id of Array.from(storedIds))if(!ids.has(id)){deps.storage.removeItem(`${quickReviewKey}:${id}`);storedIds.delete(id);storedValues.delete(id);}
 }
 function publish(){try{persist(entries);}catch{/* The original durable request remains available for an idempotent retry. */}deps.onChange([...entries]);}
 function pump(){
  if(!started)return;
  for(const entry of entries){
   if(active>=3)break;
   if(entry.state!=='queued'||entries.some(other=>other!==entry&&key(other.payload)===key(entry.payload)&&entries.indexOf(other)<entries.indexOf(entry)))continue;
   if(!entry.attempted)entry.payload={...entry.payload,version:Math.max(entry.payload.version,versions.get(key(entry.payload))??0)};
   entry.attempted=true;entry.state='saving';active++;publish();
   void deps.send(entry.payload).then(async response=>{
    const board=await response.json();
    if(!started)return;
    if(!response.ok)throw Object.assign(new Error(board.error||'Unable to sync this choice.'),{status:response.status});
    versions.set(key(entry.payload),board.stock[entry.payload.itemId]?.version??entry.payload.version+1);
    entries=entries.filter(value=>value!==entry);publish();deps.onSaved(board);
   }).catch(error=>{
    if(!started)return;
    entry.state='failed';entry.conflict=error.status===409;entry.error=entry.conflict?'Changed on another device. Review before retrying.':'Not synced. Your choice is kept on this device.';publish();
   }).finally(()=>{active--;pump();});
  }
 }
 return {
  start(){
   try{const raw=[];for(let i=0;i<deps.storage.length;i++){const key=deps.storage.key(i);if(key?.startsWith(`${quickReviewKey}:`)){raw.push(JSON.parse(deps.storage.getItem(key)||'null'));}}entries=raw.filter(e=>e?.payload?.action==='checkItem'&&typeof e.name==='string'&&typeof e.at==='string'&&typeof e.payload.requestId==='string'&&typeof e.payload.itemId==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(e.payload.date)&&Number.isInteger(e.payload.version)&&['order','sufficient','cancelOrder'].includes(e.payload.decision)).map(e=>({...e,state:e.state==='failed'?'failed':'queued'})).sort((a,b)=>a.at.localeCompare(b.at));for(const e of entries)storedIds.add(e.payload.requestId);}catch{throw new Error('Device storage is unavailable. Keep this page open and try again.');}
   started=true;publish();pump();
  },
  stop(){started=false;},
  enqueue(payload:QuickPayload,name:string){
   if(!started)throw new Error('Device storage is not ready. Reload and try again.');
   const last=[...entries].reverse().find(e=>key(e.payload)===key(payload));
   if(last&&last.payload.decision===payload.decision&&last.payload.quantity===payload.quantity&&last.payload.unit===payload.unit&&last.payload.orderQuantity===payload.orderQuantity&&last.payload.orderUnit===payload.orderUnit&&last.payload.flagOnly===payload.flagOnly&&last.state!=='failed')return;
   const entry:QuickEntry={payload,name,at:deps.now(),state:'queued'};
   const next=entries.filter(e=>!(key(e.payload)===key(payload)&&e.payload.decision===payload.decision&&e.state==='queued'&&!e.attempted));
   next.push(entry);persist(next);entries=next;deps.onChange([...entries]);pump();
  },
  async retry(includeConflicts=true){
   if(retrying)return;retrying=true;
   try {
   const failed=entries.filter(e=>e.state==='failed'&&(includeConflicts||!e.conflict));
   const board=failed.some(e=>e.conflict)?await deps.latest():null;
   for(const entry of failed){
    if(entry.conflict&&board){
     if(entry.payload.date!==board.today){entry.error='This choice is from an earlier day. Discard it and review the item for today.';continue;}
     entry.payload={...entry.payload,requestId:deps.uuid(),version:board.stock[entry.payload.itemId]?.version||0};entry.attempted=false;
    }
    entry.state='queued';entry.error=undefined;entry.conflict=false;
   }
   publish();pump();
   } finally { retrying=false; }
  },
  discard(id:string){entries=entries.filter(e=>e.payload.requestId!==id||e.state==='saving');publish();pump();},
 };
}
export function overlayQuickReviews(stock:InventoryRecords,date:string,entries:QuickEntry[]):InventoryRecords {
 const next={...stock};
 for(const e of entries){const p=e.payload;if(p.date!==date)continue;
  const previous=next[p.itemId];
  if(p.decision==='cancelOrder'){
   if(previous)next[p.itemId]={...previous,orderOpen:false,orderRequestedAt:null,updatedAt:e.at};
   continue;
  }
  next[p.itemId]={...previous,version:previous?.version||0,quantity:p.quantity??previous?.quantity??null,unit:p.unit||previous?.unit||'each',...(p.quantity!==undefined?{stockSource:'count' as const,countedAt:e.at,stockUpdatedAt:e.at,lastCountQuantity:p.quantity,lastCountUnit:p.unit}:{}),...(p.orderQuantity!==undefined?{orderQuantity:p.orderQuantity,orderUnit:p.orderUnit}:{}),checkedOn:date,checkedAt:e.at,updatedAt:e.at,checkedBy:'This device · syncing',decision:p.decision,nextCheck:date,orderOpen:p.decision==='order'||Boolean(previous?.orderOpen),orderRequestedAt:p.decision==='order'?previous?.orderRequestedAt||e.at:previous?.orderRequestedAt||null};
 }
 return next;
}
