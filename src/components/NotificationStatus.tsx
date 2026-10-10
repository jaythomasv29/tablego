'use client';
import { useState } from 'react';
import { Button } from './ui/button';
interface Delivery { id: string; event: string; channel: string; recipient: string; state: string; attempts: number; lastError: string | null }
const labels: Record<string, string> = { queued: 'Queued', sending: 'Sending', delivered: 'Sent', failed: 'Retry scheduled', exhausted: 'Needs attention', superseded: 'Replaced by a newer update' };
export default function NotificationStatus({ reservationId }: { reservationId: string }) {
  const [open, setOpen] = useState(false), [jobs, setJobs] = useState<Delivery[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function load(notificationId?: string) {
    setBusy(true); setError('');
    try {
      const endpoint = `/api/staff/reservations/${encodeURIComponent(reservationId)}/notifications`;
      if (notificationId) {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notificationId }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to retry notification');
      }
      const response = await fetch(endpoint, { cache: 'no-store' }), data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load delivery status');
      setJobs(data.notifications);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2 text-xs">
    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" aria-expanded={open} onClick={() => { setOpen(!open); if (!open) void load(); }}>Message delivery</Button>
    {open && <div className="space-y-2 rounded-md border p-3" aria-live="polite">
      <p>Booking changes are saved independently of message delivery.</p>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => load()}>{busy ? 'Loading…' : 'Refresh status'}</Button>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {!busy && !error && jobs.length === 0 && <p>No messages recorded for this booking.</p>}
      <ul className="space-y-2">{jobs.map(job => <li key={job.id} className="flex flex-wrap items-center gap-2 border-t pt-2">
        <span>{job.event} · {job.recipient} · {job.channel}: <strong>{labels[job.state] || job.state}</strong> ({job.attempts} attempts)</span>
        {['failed', 'exhausted'].includes(job.state) && <Button size="sm" variant="outline" disabled={busy} onClick={() => load(job.id)}>Retry message</Button>}
      </li>)}</ul>
    </div>}
  </div>;
}
