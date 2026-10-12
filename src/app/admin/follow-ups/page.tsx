'use client';
import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useReservations } from '@/components/service/useReservations';
import { Button } from '@/components/ui/button';
import { feedbackSettings, followUpEligibility } from '@/lib/reservations/feedbackPolicy';
import { formatReadableDatePST } from '@/utils/dateUtils';
import NotificationStatus from '@/components/NotificationStatus';
export default function FollowUpsPage() {
  const { bookings, timezone, loading, error } = useReservations();
  const [delay, setDelay] = useState<number | null>(null), [busy, setBusy] = useState(''), [notice, setNotice] = useState(''), [failure, setFailure] = useState(''), [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/staff/settings', { signal: controller.signal, cache: 'no-store' }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setDelay(feedbackSettings(body).followUpDelayMinutes); }).catch(err => { if (err.name !== 'AbortError') setFailure('Unable to load follow-up settings. Reload to try again.'); });
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
  async function send(id: string) {
    setBusy(id); setFailure(''); setNotice('');
    try { const response = await fetch('/api/send-followup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reservationIds: [id] }) }), data = await response.json();
      if (!response.ok || !data.results?.[0]?.success) throw new Error(data.results?.[0]?.error || data.error || 'Unable to queue follow-up');
      setNotice('Follow-up queued. Check delivery details if the guest does not receive it.');
    } catch (err) { setFailure((err as Error).message); } finally { setBusy(''); }
  }
  const visits = bookings.filter(booking => booking.status === 'completed' || booking.followUpSent || booking.followUpEventId || booking.feedbackReceivedAt || booking.privateFeedback).sort((a, b) => b.date.localeCompare(a.date));
  return <AdminLayout><main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8"><header><h1 className="text-3xl font-semibold">Visit follow-ups</h1><p className="mt-2 text-sm text-muted-foreground">Send an optional feedback request after staff complete a visit. Delay: {delay ?? '…'} minutes after completion. All visit dates use {timezone}.</p><p className="mt-2 text-sm text-muted-foreground">Guest feedback stays separate from attendance. Guests can stop future feedback emails.</p></header>
    {(failure || error) && <p role="alert" className="text-red-700">{failure || error}</p>}{notice && <p role="status">{notice}</p>}
    {process.env.NEXT_PUBLIC_TABLEGO_ENVIRONMENT === 'staging' && <p className="rounded-lg border p-3 text-sm">Staging captures follow-up emails for testing. They do not arrive in a live inbox.</p>}
    {loading || delay === null ? <p role="status">{failure ? 'Follow-up settings are unavailable.' : 'Loading visits…'}</p> : !visits.length ? <p>No completed visits or feedback yet.</p> : <div className="space-y-4">{visits.map(visit => {
      const eligible = followUpEligibility({ ...visit, feedbackSubmissionHash: visit.feedbackReceivedAt }, timezone, delay, now);
      return <article key={visit.id} className="space-y-3 rounded-xl border bg-card p-5"><h2 className="font-semibold">{visit.name}</h2><p className="text-sm">{visit.date ? formatReadableDatePST(visit.date, timezone) : 'Date needs review'} · {visit.time}</p>
        {visit.feedbackReceivedAt || visit.privateFeedback ? <div className="space-y-2"><p className="text-sm font-medium">Guest report: {visit.feedbackSentiment || 'Legacy feedback'}</p><p className="whitespace-pre-wrap break-words text-sm">{visit.privateFeedback || 'No written comment'}</p></div> : visit.followUpSent ? <p className="text-sm">Follow-up sent · Awaiting optional feedback</p> : visit.followUpEventId ? <p className="text-sm">Follow-up queued · Review delivery in Reservations if needed</p> : <><p className="text-sm text-muted-foreground">{eligible.reason}</p><Button disabled={!!busy || !eligible.eligible} onClick={() => send(visit.id)}>{busy === visit.id ? 'Queuing…' : 'Send follow-up'}</Button></>}
        {(visit.followUpEventId || visit.feedbackReceivedAt) && <details><summary className="cursor-pointer text-sm underline">Delivery details and retry</summary><div className="mt-3"><NotificationStatus reservationId={visit.id} /></div></details>}
      </article>;
    })}</div>}
    <a className="text-sm underline" href="/admin/reservation">Open reservations and delivery details</a>
  </main></AdminLayout>;
}
