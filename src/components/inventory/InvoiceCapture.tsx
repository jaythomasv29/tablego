'use client';
import { useState } from 'react';
import { extractInvoiceHeader, extractInvoiceLines, MAX_INVOICE_BYTES, type InvoiceHeaderSuggestion, type InvoiceSuggestion } from '@/lib/inventory/invoiceExtraction';
export type InvoiceCaptureResult = { attachmentId: string; rawText: string; header: InvoiceHeaderSuggestion; lines: InvoiceSuggestion[] };
async function preparePhoto(file: File) {
  if (file.type === 'application/pdf') return file;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const scale = Math.min(1,2000 / Math.max(img.naturalWidth,img.naturalHeight)), canvas = document.createElement('canvas');
    canvas.width = Math.max(1,Math.round(img.naturalWidth*scale)); canvas.height = Math.max(1,Math.round(img.naturalHeight*scale));
    const context = canvas.getContext('2d'); if (!context) throw new Error('Unable to prepare this photo.');
    context.fillStyle = '#fff'; context.fillRect(0,0,canvas.width,canvas.height); context.drawImage(img,0,0,canvas.width,canvas.height);
    const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Unable to prepare photo.')),'image/jpeg',0.85));
    return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});
  } finally { URL.revokeObjectURL(url); }
}
export default function InvoiceCapture({ onCapture, onBusyChange, onPendingChange }: { onCapture: (value: InvoiceCaptureResult) => void; onBusyChange?: (busy: boolean) => void; onPendingChange?: (pending: boolean) => void }) {
  const [busy,setBusy] = useState(false), [status,setStatus] = useState(''), [error,setError] = useState(''), [attachmentId,setId] = useState(''), [rawText,setText] = useState('');
  async function upload(file?: File) {
    if (!file || busy) return;
    setBusy(true); onBusyChange?.(true); onPendingChange?.(true); setError(''); setId(''); setText(''); setStatus('Preparing invoice…');
    try {
      if (!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)) throw new Error('Choose a JPEG, PNG, WebP photo or PDF.');
      const prepared = await preparePhoto(file);
      if (prepared.size > MAX_INVOICE_BYTES) throw new Error('Choose an invoice up to 3 MB. Try photographing one page at a time.');
      const form = new FormData(); form.append('file',prepared); setStatus('Saving private invoice…');
      const response = await fetch('/api/staff/inventory/attachments',{method:'POST',body:form}); const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save invoice.');
      setId(result.attachmentId);
      if (prepared.type === 'application/pdf') { setStatus('PDF saved. Enter or paste its line items below for review. Photo text reading supports images.'); return; }
      setStatus('Reading photo text on this device…');
      try {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('eng',1,{logger:message => { if (message.status === 'recognizing text') setStatus(`Reading photo text… ${Math.round(message.progress*100)}%`); }});
        try { const read = await worker.recognize(prepared); setText(read.data.text.slice(0,30000)); setStatus('Photo saved. Review the text before using it.'); }
        finally { await worker.terminate(); }
      } catch { setStatus('Photo saved. Automatic text reading was unavailable; enter the invoice details below.'); }
    } catch (error) { setError((error as Error).message); setStatus(''); }
    finally { setBusy(false); onBusyChange?.(false); }
  }
  return <section aria-label="Capture invoice" style={{display:'grid',gap:12}}>
    <p>Photograph one invoice page or upload a file. Photos are resized and read on your device; invoice copies are stored privately for staff review. Nothing changes stock automatically.</p>
    <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
      <label style={{minHeight:44,padding:12,border:'1px solid #888',borderRadius:8,cursor:'pointer'}}>Take invoice photo<input aria-label="Take invoice photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy} onChange={event => { void upload(event.target.files?.[0]); event.target.value=''; }} style={{display:'block',maxWidth:'100%'}} /></label>
      <label style={{minHeight:44,padding:12,border:'1px solid #888',borderRadius:8}}>Upload photo or PDF<input aria-label="Upload invoice file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy} onChange={event => { void upload(event.target.files?.[0]); event.target.value=''; }} style={{display:'block',maxWidth:'100%'}} /></label>
    </div>
    <p role="status" aria-live="polite">{status}</p>{!busy && (attachmentId || error) && <button type="button" onClick={() => { setId(''); setText(''); setError(''); setStatus('Capture discarded. No stock changes were made.'); onPendingChange?.(false); }} style={{minHeight:44}}>Discard this capture</button>}{error && <p role="alert">{error}</p>}
    {attachmentId && <><a href={`/api/staff/inventory/attachments?id=${encodeURIComponent(attachmentId)}`} target="_blank" rel="noreferrer">View saved invoice</a><label>Review invoice text<textarea aria-label="Review invoice text" rows={8} maxLength={30000} value={rawText} onChange={event => setText(event.target.value)} style={{display:'block',width:'100%',padding:12}} /></label><p>Text reading can miss quantities, prices, and product codes. Confirm every line before saving an invoice.</p><button type="button" disabled={busy} onClick={() => { onCapture({attachmentId,rawText,header:extractInvoiceHeader(rawText),lines:extractInvoiceLines(rawText)}); onPendingChange?.(false); }} style={{minHeight:44}}>Use invoice details</button></>}
  </section>;
}
