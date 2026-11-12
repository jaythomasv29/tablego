'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,useSyncExternalStore,useMemo} from 'react';
import {createQuickReviewQueue,type QuickEntry,type QuickPayload} from '@/lib/inventory/quickReviewQueue';
import {mergeInventoryBoard} from '@/lib/inventory/progress';
import type {OperationsBoard} from '@/lib/inventory/operations';
type Queue=ReturnType<typeof createQuickReviewQueue>;
const Context=createContext<{entries:QuickEntry[];enqueue:(payload:QuickPayload,name:string)=>void;result:{id:number;board:OperationsBoard}|null;retry:()=>Promise<void>;discard:(id:string)=>void;error:string}|null>(null);
type ItemStore={entries:QuickEntry[];listeners:Set<()=>void>;enqueue:(payload:QuickPayload,name:string)=>void};
const ItemContext=createContext<ItemStore|null>(null);
export default function InventoryQuickReviewProvider({children}:{children:React.ReactNode}){
 const [entries,setEntries]=useState<QuickEntry[]>([]),[result,setResult]=useState<{id:number;board:OperationsBoard}|null>(null),[error,setError]=useState('');
 const queue=useRef<Queue|null>(null),sequence=useRef(0);
 const itemStore=useRef<ItemStore>({entries:[],listeners:new Set(),enqueue:(payload,name)=>{if(!queue.current)throw new Error('Device storage is not ready. Try again.');queue.current.enqueue(payload,name);}});
 useEffect(()=>{
  const worker=createQuickReviewQueue({storage:localStorage,uuid:()=>crypto.randomUUID(),now:()=>new Date().toISOString(),send:async payload=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{const r=await fetch('/api/staff/inventory/operations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});const body=await r.json();return {ok:r.ok,status:r.status,json:async()=>body};}finally{clearTimeout(timer);}},latest:async()=>{const r=await fetch('/api/staff/inventory/operations',{cache:'no-store'});if(!r.ok)throw new Error('Unable to load the latest inventory.');return r.json();},onChange:entries=>{itemStore.current.entries=entries.map(e=>{const old=itemStore.current.entries.find(p=>p.payload.requestId===e.payload.requestId);return old&&old.state===e.state&&old.error===e.error&&old.payload===e.payload?old:{...e};});itemStore.current.listeners.forEach(listener=>listener());setEntries(entries);},onSaved:board=>{const id=++sequence.current;setResult(previous=>({id,board:mergeInventoryBoard(previous?.board||null,board)}));}});
  queue.current=worker;try{worker.start();}catch(e){setError((e as Error).message);}
  const online=()=>{void worker.retry(false).catch(e=>setError(e.message));};window.addEventListener('online',online);
  return()=>{worker.stop();queue.current=null;window.removeEventListener('online',online);};
 },[]);
 const enqueue=useCallback((payload:QuickPayload,name:string)=>{if(!queue.current)throw new Error('Device storage is not ready. Try again.');queue.current.enqueue(payload,name);},[]);
 return <ItemContext.Provider value={itemStore.current}><Context.Provider value={{entries,result,error,enqueue,retry:async()=>{setError('');try{await queue.current?.retry();}catch(e){setError((e as Error).message);}},discard:id=>queue.current?.discard(id)}}>{children}</Context.Provider></ItemContext.Provider>;
}
export function useInventoryQuickReview(onSaved?:(board:OperationsBoard)=>void){
 const value=useContext(Context),seen=useRef(value?.result?.id||0);
 useEffect(()=>{if(value?.result&&value.result.id!==seen.current){seen.current=value.result.id;onSaved?.(value.result.board);}},[value?.result,onSaved]);
 return value;
}
// Subscribe to this item only: another tap must not rerender every stock form.
export function useInventoryQuickItem(itemId:string,date:string){
 const store=useContext(ItemContext);
 const subscribe=useCallback((listener:()=>void)=>{store?.listeners.add(listener);return()=>{store?.listeners.delete(listener);};},[store]);
 const snapshot=useCallback(()=>store?.entries.slice().reverse().find(e=>e.payload.itemId===itemId&&e.payload.date===date),[store,itemId,date]);
 const entry=useSyncExternalStore(subscribe,snapshot,()=>undefined);
 return useMemo(()=>store?{entries:entry?[entry]:[],enqueue:store.enqueue}:null,[store,entry]);
}
export function InventoryQuickStatus(){
 const queue=useInventoryQuickReview();if(!queue||(!queue.entries.length&&!queue.error))return null;
 const failed=queue.entries.filter(e=>e.state==='failed');
 return <aside className="admin-sync-status" aria-label="Inventory sync"><p role="status">{queue.entries.length} inventory choice{queue.entries.length===1?'':'s'} kept on this device · {failed.length?`${failed.length} need attention`:'Syncing in background…'}</p>{queue.error&&<p role="alert">{queue.error}</p>}{failed.length>0&&<details><summary>Review unsynced choices</summary><ul>{failed.map(e=><li key={e.payload.requestId}>{e.name}: {e.payload.decision==='cancelOrder'?'Remove from To order':e.payload.decision==='order'?'Order':'Enough'} — {e.error} <button onClick={()=>queue.discard(e.payload.requestId)}>Discard</button></li>)}</ul><button onClick={()=>void queue.retry()}>Retry saved choices using latest stock</button></details>}</aside>;
}
