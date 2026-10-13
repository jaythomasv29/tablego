'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { cateringStatusLabels, type CateringStatus } from '@/lib/catering/admin';
type Preview = { operationId: string | null; totalActive: number; limit: number; timezone: string; items: { id: string; name: string; date: string; status: CateringStatus }[] };
export default function BulkCloseCatering({ disabled, onClosed }: { disabled: boolean; onClosed: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false), [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function close() { if (busy) return; controller.current?.abort(); setOpen(false); setPreview(null); setError(''); }
  async function review() {
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setOpen(true); setLoading(true); setError(''); setPreview(null);
    try {
      const response = await fetch('/api/staff/catering/bulk-close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'preview' }), signal: request.signal });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to review active inquiries.');
      if (!request.signal.aborted) setPreview(body);
    } catch (err) { if (!request.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to review active inquiries.'); }
    finally { if (!request.signal.aborted) setLoading(false); }
  }
  async function confirm() {
    if (busy || !preview?.operationId) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/staff/catering/bulk-close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'confirm', operationId: preview.operationId }) });
      const body = await response.json(); if (!response.ok) { if (response.status === 409) setPreview(null); throw new Error(body.error || 'Unable to close inquiries. Retry the same reviewed action.'); }
      onClosed(body.ids); setOpen(false); setPreview(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to check the result. Retry this action; it will not close additional inquiries.'); }
    finally { setBusy(false); }
  }
  const confirmed = preview?.items.filter(item => item.status === 'confirmed').length || 0;
  return <>
    <Button variant="outline" onClick={review} disabled={disabled}>Close all active inquiries</Button>
    <Dialog open={open} onOpenChange={value => { if (!value) close(); }}><DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-xl" showCloseButton={!busy}>
      <DialogTitle>Close active inquiries?</DialogTitle>
      <DialogDescription>Start fresh by marking the reviewed inquiries Completed. Their records, guest details and staff notes stay in Closed; follow-up dates are cleared.</DialogDescription>
      <p className="text-xs text-muted-foreground">This includes active inquiries outside your current search and filters. Customer messages are not sent.</p>
      {loading && <p role="status">Reviewing the current active inquiries…</p>}
      {error && <p role="alert" className="shrink-0 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}
      {preview && <>
        <p className="text-lg font-semibold">{preview.items.length} {preview.items.length === 1 ? 'inquiry' : 'inquiries'} will be marked Completed.</p>
        {preview.totalActive > preview.items.length && <p className="text-sm text-muted-foreground">There are {preview.totalActive} active inquiries. This action closes the oldest {preview.limit} at a time; repeat it to close the remaining inquiries.</p>}
        {confirmed > 0 && <p className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">Includes {confirmed} confirmed {confirmed === 1 ? 'event' : 'events'}. Check the list before closing.</p>}
        {!preview.items.length ? <p className="text-sm text-muted-foreground">Your active inbox is already clear.</p> : <ul className="min-h-0 space-y-3 overflow-y-auto rounded-lg border p-3 text-sm" aria-label="Inquiries to close">{preview.items.map(item => <li key={item.id}><p className="break-words font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.date ? formatDateForDisplay(item.date, preview.timezone) : 'Event date needs review'} · {cateringStatusLabels[item.status]}</p></li>)}</ul>}
        <p className="text-xs text-muted-foreground">New inquiries arriving after this review stay active. Changed inquiries require a fresh review. You can reopen a closed inquiry individually.</p>
      </>}
      <div className="mt-1 flex shrink-0 flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="outline" autoFocus disabled={busy} onClick={close}>Keep inquiries</Button>
        {!loading && !preview && <Button disabled={busy} onClick={review}>Review again</Button>}
        {preview && <Button disabled={busy || !preview.operationId || !preview.items.length} onClick={confirm}>{busy ? 'Closing inquiries…' : `Mark ${preview.items.length} completed`}</Button>}
      </div>
    </DialogContent></Dialog>
  </>;
}
