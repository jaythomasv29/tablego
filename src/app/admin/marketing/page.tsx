'use client';
import MarketingTestModal from '@/components/marketing/MarketingTestModal';
import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { MarketingCandidate, MarketingKind } from '@/lib/marketing/policy';
import { formatDateForDisplay } from '@/utils/dateUtils';

type Candidate = MarketingCandidate & { subject: string; body: string; previewHash: string; html?: string };
interface History { id: string; candidate: MarketingCandidate; subject: string; body: string; state: string; approvedAt: string; deliveryMode?: string; attempts?: number }
interface Queue { candidates: Candidate[]; history: History[]; today: string }
export default function MarketingPage() {
  const [data, setData] = useState<Queue | null>(null), [kind, setKind] = useState<MarketingKind>('reservation');
  const [testOpen, setTestOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]), [review, setReview] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/staff/marketing', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load follow-ups.');
      setData(result); setSelected([]);
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to load follow-ups.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const candidates = data?.candidates.filter(item => item.kind === kind) || [];
  const history = data?.history.filter(item => item.candidate.kind === kind) || [];
  async function act(items: Candidate[], action: 'approve' | 'dismiss') {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/staff/marketing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: items.map(item => item.id), action, previews: Object.fromEntries(items.map(item => [item.id, item.previewHash])) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save approval.');
      setReview([]);
      setNotice(action === 'dismiss' ? 'Selected follow-ups dismissed for this inactive period.' : `${result.queued} email${result.queued === 1 ? '' : 's'} approved and queued. Refresh delivery history to see the result.`);
      await load();
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save approval.'); }
    finally { setBusy(false); }
  }
  return <AdminLayout><main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-semibold">Marketing follow-ups</h1><p className="mt-2 text-sm text-muted-foreground">Welcome customers back after more than 30 days. Every email requires your approval.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => setTestOpen(true)}>Send test email</Button><Button variant="outline" disabled={loading || busy} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh queue & history'}</Button></div></div>
    <div className="flex flex-wrap gap-2" aria-label="Follow-up category">{(['reservation', 'catering'] as const).map(value => <Button key={value} variant={kind === value ? 'default' : 'outline'} aria-pressed={kind === value} disabled={busy} onClick={() => { setKind(value); setSelected([]); }}>{value === 'reservation' ? 'Reservations' : 'Catering'}</Button>)}</div>
    <p className="text-sm text-muted-foreground">{kind === 'reservation' ? 'Based on the latest pending, confirmed, or completed reservation date.' : 'Based on the latest completed catering event date; inquiries alone do not qualify.'} Upcoming bookings, unsubscribed customers, test records, and previously handled follow-ups are excluded. One follow-up per customer and inactive period, in each category.</p>
    {notice && <p role="status" className="rounded-lg border p-4">{notice}</p>}{error && <p role="alert" className="text-destructive">{error}</p>}
    {loading ? <p role="status">Checking customer history…</p> : <section className="space-y-4" aria-label="Awaiting approval">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Awaiting approval · {candidates.length}</h2><Button disabled={busy || !selected.length} onClick={() => setReview(candidates.filter(item => selected.includes(item.id)))}>Review selected ({selected.length})</Button></div>
      {candidates.length > 0 && <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={selected.length === Math.min(candidates.length, 50)} disabled={busy} onChange={event => setSelected(event.target.checked ? candidates.slice(0, 50).map(item => item.id) : [])} />Select up to 50 customers</label>}
      {!candidates.length && <div className="rounded-xl border p-8 text-center text-muted-foreground">No customers awaiting approval in this category.</div>}
      <div className="space-y-3">{candidates.map(item => <article key={item.id} className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4"><label className="flex min-h-11 min-w-11 items-center justify-center"><input type="checkbox" aria-label={`Select ${item.name}`} checked={selected.includes(item.id)} disabled={busy || (!selected.includes(item.id) && selected.length >= 50)} onChange={event => setSelected(previous => event.target.checked ? [...previous, item.id] : previous.filter(id => id !== item.id))} /></label><div className="min-w-0 flex-1"><h3 className="font-semibold">{item.name}</h3><p className="break-all text-sm">{item.email}</p><p className="text-sm text-muted-foreground">Last {kind === 'catering' ? 'event' : 'reservation'}: {formatDateForDisplay(item.lastDate)} · {item.inactiveDays} days ago</p></div><Button variant="outline" disabled={busy} onClick={() => setReview([item])}>Review email</Button></article>)}</div>
    </section>}
    <section className="space-y-4"><h2 className="text-xl font-semibold">Approval & delivery history</h2><p className="text-sm text-muted-foreground">Latest 200 follow-ups across both categories. Queued emails are approved but not yet delivered. Captured emails were saved for testing.</p>{!history.length && <p className="text-sm text-muted-foreground">No follow-ups handled yet.</p>}{history.map(item => <details key={item.id} className="rounded-xl border p-4"><summary className="min-h-11 cursor-pointer break-words">{item.candidate.name} · {item.candidate.email} · <span className="font-semibold">{item.state === 'delivered' && item.deliveryMode === 'capture' ? 'Captured for testing' : item.state === 'delivered' ? 'Sent to email provider' : item.state}</span></summary><p className="text-sm text-muted-foreground">Approved/handled: {new Date(item.approvedAt).toLocaleString()} · Attempts: {item.attempts || 0}</p><h3 className="mt-3 font-semibold">{item.subject}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.body}</p></details>)}</section>
    <Dialog open={review.length > 0} onOpenChange={open => { if (!open && !busy) setReview([]); }}><DialogContent showCloseButton={!busy} className="max-h-[85vh] overflow-y-auto"><DialogTitle>Review {review.length} follow-up email{review.length === 1 ? '' : 's'}</DialogTitle><DialogDescription>Approval queues these exact emails for sending. Each email includes an unsubscribe link. No email is sent when you dismiss or close this review.</DialogDescription>{review.map(item => <article key={item.id} className="space-y-3 rounded-lg border p-4"><p className="break-all text-sm">To: {item.name} · {item.email}</p><h3 className="font-semibold">{item.subject}</h3><p className="sr-only">{item.body}</p>{item.html ? <iframe title={`Email preview for ${item.name}`} srcDoc={item.html} sandbox="" className="h-[540px] w-full rounded-lg border bg-white" /> : <p className="whitespace-pre-wrap break-words text-sm">{item.body}</p>}<p className="text-xs text-muted-foreground">Includes an unsubscribe link.</p></article>)}{error && <p role="alert" className="text-destructive">{error}</p>}<div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => setReview([])}>Keep for later</Button><Button variant="outline" disabled={busy} onClick={() => void act(review, 'dismiss')}>Dismiss follow-up{review.length === 1 ? '' : 's'}</Button><Button disabled={busy} onClick={() => void act(review, 'approve')}>{busy ? 'Saving…' : `Approve & send ${review.length} email${review.length === 1 ? '' : 's'}`}</Button></div></DialogContent></Dialog>
    {testOpen && <MarketingTestModal initialKind={kind} onClose={() => setTestOpen(false)} />}
  </main></AdminLayout>;
}
