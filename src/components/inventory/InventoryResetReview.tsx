'use client';
import {useRef,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {useInventoryQuickReview} from './InventoryQuickReviewProvider';
import type {InventoryRecords} from '@/lib/inventory/model';
import type {OperationsBoard} from '@/lib/inventory/operations';
export default function InventoryResetReview({stock,date,onReset,disabled=false}:{stock:InventoryRecords;date:string;onReset:(board:OperationsBoard)=>void;disabled?:boolean}){
 const quick=useInventoryQuickReview(),pending=Boolean(quick?.entries.length);
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const payload=useRef<Record<string,unknown>|null>(null),lock=useRef(false);
 async function reset(){
  if(lock.current||pending)return;lock.current=true;setBusy(true);setError('');
  payload.current??={action:'resetReview',requestId:crypto.randomUUID(),date,versions:Object.fromEntries(Object.entries(stock).map(([id,item])=>[id,item.version]))};
  try{
   const response=await fetch('/api/staff/inventory/operations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload.current)});
   const board=await response.json();
   if(!response.ok){if(response.status<500)payload.current=null;throw new Error(board.error||'Unable to reset inventory check.');}
   payload.current=null;onReset(board);setOpen(false);
  }catch(e){setError((e as Error).message||'Unable to confirm the reset. Retry to safely confirm the same request.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <><button type="button" className="min-h-11" disabled={disabled||pending} onClick={()=>{setError('');setOpen(true);}}>Reset inventory check</button>{pending&&<span className="text-sm text-muted-foreground">Sync pending choices before resetting.</span>}
 <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}><DialogContent><DialogTitle>Start inventory check again?</DialogTitle><DialogDescription>This resets the review for all categories, so every item needs checking again. Stock amounts, count history, your order list and unfinished drafts stay saved. This applies to everyone using Inventory.</DialogDescription>{error&&<p role="alert">{error}</p>}<div className="flex flex-wrap gap-3"><button className="min-h-11 rounded-lg border px-4" disabled={busy} onClick={()=>setOpen(false)}>Keep current check</button><button className="min-h-11 rounded-lg border px-4 font-semibold" disabled={busy||pending} onClick={()=>void reset()}>{busy?'Resetting…':error&&payload.current?'Retry reset':'Reset and start again'}</button></div></DialogContent></Dialog></>;
}
