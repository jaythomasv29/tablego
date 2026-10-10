'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
export default function DeliverySummary() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/staff/notifications/summary', { cache: 'no-store' }), data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Delivery status unavailable');
      setCounts(data.counts); setError('');
    } catch (err) { setError((err as Error).message); }
  }, []);
  useEffect(() => { void load(); const timer = setInterval(load, 60000); return () => clearInterval(timer); }, [load]);
  async function process() {
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/notifications/process', { method: 'POST' }), data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to process messages');
      setNotice(`Processed ${data.scanned} due messages: ${data.delivered} sent, ${data.failed} failed, ${data.skipped} skipped.`); await load();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="space-y-2 rounded-xl border bg-card p-4" aria-label="Message delivery backlog">
    <h2 className="font-semibold">Message delivery</h2>
    {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : counts ? <p className="text-sm">{counts.queued} queued · {counts.failed} awaiting retry · {counts.sending} sending · {counts.exhausted} need attention</p> : <p role="status">Loading delivery status…</p>}
    <p className="text-xs text-muted-foreground">Booking changes remain saved. Open a booking&apos;s delivery history to retry a specific failed message.</p>
    <Button size="sm" variant="outline" disabled={busy} onClick={process}>{busy ? 'Processing…' : 'Process up to five due messages'}</Button>
    {notice && <p role="status" className="text-sm">{notice}</p>}
  </section>;
}
