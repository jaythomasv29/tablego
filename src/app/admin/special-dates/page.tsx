'use client';
import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import AdminLayout from '@/components/AdminLayout';
import { useTimezone } from '@/contexts/TimezoneContext';
import { closureDate, restaurantClock } from '@/lib/reservations/availability';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
type Closure = { id: string; date: string; reason: string; closureType: 'full' | 'lunch' | 'dinner' };
const blank = { id: '', date: '', reason: '', closureType: 'full' as const };
export default function SpecialDatesAdmin() {
  const { timezone, loading: settingsLoading, error: settingsError } = useTimezone();
  const opener = useRef<HTMLButtonElement | null>(null);
  const restoreFocus = (event: Event) => { if (opener.current?.isConnected) { event.preventDefault(); opener.current.focus(); } };
  const [closures, setClosures] = useState<Closure[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [editing, setEditing] = useState<Closure | null>(null), [deleting, setDeleting] = useState<Closure | null>(null), [busy, setBusy] = useState(false);
  useEffect(() => onSnapshot(collection(db, 'specialDates'), snapshot => {
    setClosures(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Closure)).sort((a, b) => b.date.localeCompare(a.date)));
    setLoading(false); setError('');
  }, () => { setError('Closures could not be loaded. Refresh before making changes.'); setLoading(false); }), []);
  async function mutate(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/staff/closures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Unable to save closure');
      setEditing(null); setDeleting(null);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <AdminLayout><div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
    <h1 className="text-2xl font-semibold">Business holidays &amp; closures</h1>
    <p className="text-sm text-muted-foreground">Closures use the restaurant calendar in {timezone}. Multiple closures on a date combine in the booking policy.</p>
    {(error || settingsError) && <p role="alert" className="text-red-600">{error || settingsError}</p>}
    <Button onClick={event => { opener.current = event.currentTarget; setError(''); setEditing({ ...blank }); }} disabled={loading || settingsLoading || Boolean(settingsError)}>Add closure</Button>
    {loading ? <div role="status" className="h-32 animate-pulse rounded-xl bg-muted">Loading closures…</div> : !closures.length ? <p>No closures recorded. Add a date to block its full day, lunch or dinner.</p> : <ul className="divide-y rounded-xl border bg-card px-4">
      {closures.map(item => { const day = closureDate(item.date), past = day && day < restaurantClock(timezone).date;
        return <li key={item.id} className={`flex flex-wrap items-center justify-between gap-3 py-4 ${past ? 'text-muted-foreground' : ''}`}>
          <div><p className="font-medium">{day ? formatDateForDisplay(day) : 'Date needs review'}{past ? ' · Past' : ''}</p><p className="text-sm">{item.reason} · {item.closureType || 'full'} closed</p></div>
          <div className="flex gap-2"><Button variant="outline" size="sm" onClick={event => { opener.current = event.currentTarget; setError(''); setEditing({ ...item, date: day || '', closureType: item.closureType || 'full' }); }}>Edit</Button><Button variant="outline" size="sm" onClick={event => { opener.current = event.currentTarget; setError(''); setDeleting(item); }}>Delete</Button></div>
        </li>; })}
    </ul>}
    <Dialog open={Boolean(editing)} onOpenChange={open => { if (!open && !busy) setEditing(null); }}><DialogContent onCloseAutoFocus={restoreFocus}>
      <DialogHeader><DialogTitle>{editing?.id ? 'Edit closure' : 'Add closure'}</DialogTitle><DialogDescription>Choose the business calendar date. Reservation records are retained when hours change.</DialogDescription></DialogHeader>
      {editing && <form className="space-y-4" onSubmit={event => { event.preventDefault(); void mutate({ action: 'save', ...editing }); }}>
        <div className="space-y-2"><Label htmlFor="closure-date">Calendar date</Label><input id="closure-date" type="date" required className="w-full rounded-md border bg-background p-2" value={editing.date} onChange={event => setEditing({ ...editing, date: event.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="closure-reason">Reason</Label><input id="closure-reason" required maxLength={200} className="w-full rounded-md border bg-background p-2" value={editing.reason} onChange={event => setEditing({ ...editing, reason: event.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="closure-period">Closed period</Label><select id="closure-period" className="w-full rounded-md border bg-background p-2" value={editing.closureType} onChange={event => setEditing({ ...editing, closureType: event.target.value as Closure['closureType'] })}><option value="full">Full day</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option></select></div>
        {error && <p role="alert" className="text-red-600">{error}</p>}<div className="flex gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(null)}>Keep current closures</Button><Button disabled={busy}>{busy ? 'Saving…' : 'Save closure'}</Button></div>
      </form>}
    </DialogContent></Dialog>
    <Dialog open={Boolean(deleting)} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}><DialogContent onCloseAutoFocus={restoreFocus} onOpenAutoFocus={event => { event.preventDefault(); document.getElementById('keep-closure')?.focus(); }}>
      <DialogHeader><DialogTitle>Delete this closure?</DialogTitle><DialogDescription>Removing the closure may reopen booking slots for this date.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-red-600">{error}</p>}<div className="flex gap-2"><Button id="keep-closure" variant="outline" disabled={busy} onClick={() => setDeleting(null)}>Keep closure</Button><Button variant="destructive" disabled={busy} onClick={() => void mutate({ action: 'delete', id: deleting?.id })}>Delete closure</Button></div>
    </DialogContent></Dialog>
  </div></AdminLayout>;
}
