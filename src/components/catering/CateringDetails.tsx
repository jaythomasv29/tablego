'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Mail, CalendarDays, MapPin, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import PhoneNumber from '@/components/PhoneNumber';
import { useTimezone } from '@/contexts/TimezoneContext';
import { formatBusinessTimestamp, formatDateForDisplay } from '@/utils/dateUtils';
import { cateringEmailLink, cateringStatusLabels, closedCatering, type CateringLead, type CateringStatus } from '@/lib/catering/admin';
import CateringStage from './CateringStage';
interface CateringEvent { id: string; event: string; timestamp: string | null; previousStatus?: CateringStatus; status?: CateringStatus; notesChanged?: boolean; followUpChanged?: boolean; followUpDate?: string; recipient?: string; bulkClosed?: boolean }
export default function CateringDetails({ id, timezone, onClose, onSaved }: { id: string; timezone: string; onClose: () => void; onSaved: (lead: CateringLead) => void }) {
  const { restaurant } = useTimezone();
  const [lead, setLead] = useState<CateringLead | null>(null), [events, setEvents] = useState<CateringEvent[]>([]);
  const [stage, setStage] = useState<CateringStatus>('pending'), [notes, setNotes] = useState(''), [followUp, setFollowUp] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [discard, setDiscard] = useState(false);
  const controller = useRef<AbortController | null>(null), endpoint = `/api/staff/catering/${encodeURIComponent(id)}`;
  const dirty = Boolean(lead && (stage !== lead.status || notes !== lead.internalNotes || followUp !== lead.followUpDate));
  const load = useCallback(async () => {
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setLoading(true); setError(''); setNotice(''); setDiscard(false);
    try {
      const response = await fetch(endpoint, { cache: 'no-store', signal: request.signal }), body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load inquiry.');
      if (!request.signal.aborted) { setLead(body.lead); setStage(body.lead.status); setNotes(body.lead.internalNotes); setFollowUp(body.lead.followUpDate); setEvents(body.events); }
    } catch (err) { if (!request.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to load inquiry.'); }
    finally { if (!request.signal.aborted) setLoading(false); }
  }, [endpoint]);
  useEffect(() => { void load(); return () => controller.current?.abort(); }, [load]);
  function close() { if (busy) return; if (dirty) setDiscard(true); else onClose(); }
  async function save() {
    if (busy || !lead) return;
    setBusy(true); setError(''); setNotice(''); setDiscard(false);
    try {
      const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: stage, originalStatus: lead.status, internalNotes: notes, followUpDate: followUp, version: lead.version }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to save inquiry.');
      setLead(body.lead); setStage(body.lead.status); setNotes(body.lead.internalNotes); setFollowUp(body.lead.followUpDate); onSaved(body.lead);
      setNotice(body.changed ? 'Inquiry saved. Staff updates are private; no customer message was sent.' : 'This inquiry is already up to date.');
      try { const history = await fetch(endpoint, { cache: 'no-store' }); if (history.ok) setEvents((await history.json()).events); } catch { /* Saving succeeded; history can be checked after reopening. */ }
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save. Your draft is kept.'); }
    finally { setBusy(false); }
  }
  const email = lead ? cateringEmailLink(lead, restaurant.name) : null;
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl" showCloseButton={!busy}>
    <div className="shrink-0 border-b px-5 py-5 pr-12 sm:px-6"><p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Catering inquiry</p><DialogTitle className="break-words text-xl">{lead?.name || 'Review inquiry'}</DialogTitle><DialogDescription className="mt-2">Review the event, contact the guest and keep the next step clear.</DialogDescription></div>
      {error && <div role="alert" className="mx-5 mt-4 shrink-0 space-y-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"><p>{error}</p><Button size="sm" variant="outline" disabled={busy || loading} onClick={load}>{lead ? 'Discard draft and reload' : 'Retry loading inquiry'}</Button></div>}
      {notice && <p role="status" className="mx-5 mt-4 shrink-0 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">{notice}</p>}
      {discard && <div role="alert" className="mx-5 mt-4 shrink-0 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"><p>You have unsaved changes. Keep editing or discard your draft?</p><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => setDiscard(false)}>Keep editing</Button><Button size="sm" variant="outline" onClick={onClose}>Discard and close</Button></div></div>}
    <div className="min-h-0 space-y-5 overflow-y-auto p-5 sm:p-6">
      {loading ? <p role="status">Loading inquiry details…</p> : lead && <>
        <div className="space-y-4 rounded-xl border bg-muted/30 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><CateringStage status={lead.status} /><span className="text-xs text-muted-foreground">{lead.eventType || 'Event type not provided'}</span></div>
          <dl className="grid gap-4 sm:grid-cols-2"><div><dt className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />Event date</dt><dd className="font-medium">{lead.date ? formatDateForDisplay(lead.date, timezone) : 'Date needs review'}</dd><dd className="mt-1 text-sm text-muted-foreground">{lead.time || 'Time to discuss'}</dd></div><div><dt className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" aria-hidden="true" />Guests & budget</dt><dd className="font-medium">{lead.partySize ? `${lead.partySize} guests` : 'Guest count not provided'}</dd><dd className="mt-1 text-sm text-muted-foreground">{lead.budget || 'Budget to discuss'}</dd></div><div className="sm:col-span-2"><dt className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />Event location</dt><dd className="break-words whitespace-pre-wrap text-sm">{lead.address || 'Location to discuss'}</dd></div></dl>
          <p className="text-xs text-muted-foreground">Event date and follow-up dates use {timezone}.</p>
          {lead.needsReview && <p className="text-sm text-amber-700 dark:text-amber-300">Some imported details need review. Confirm them with the guest.</p>}
        </div>
        <section className="space-y-3" aria-label="Guest contact"><h2 className="font-semibold">Start the conversation</h2><p className="break-all text-sm">{lead.email || 'Email not provided'}</p><p className="text-sm"><PhoneNumber phone={lead.phone} verified={lead.phoneVerified} /></p><div className="flex flex-wrap gap-2">{email && <a href={email} className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"><Mail className="h-4 w-4" aria-hidden="true" />Draft email to guest</a>}</div><p className="text-xs text-muted-foreground">Email opens your mail app. Update the stage after you’ve contacted the guest.</p></section>
        <section className="space-y-3 border-t pt-4"><h2 className="font-semibold">Requested menu</h2>{lead.selectedDishes.length ? <ul className="flex flex-wrap gap-2">{lead.selectedDishes.map((dish, index) => <li key={`${dish}-${index}`} className="max-w-full break-words rounded-lg border bg-muted/30 px-3 py-1.5 text-sm">{dish}</li>)}</ul> : <p className="text-sm text-muted-foreground">No dishes selected yet. Discuss the menu with the guest.</p>}<h3 className="pt-1 text-sm font-medium">Guest requests</h3><p className="break-words whitespace-pre-wrap text-sm text-muted-foreground">{lead.specialRequests || 'No special requests provided.'}</p></section>
        <form id="catering-update" className="space-y-4 rounded-xl border bg-muted/30 p-4" onSubmit={event => { event.preventDefault(); void save(); }}>
          <h2 className="font-semibold">Staff follow-up</h2><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="catering-stage">Inquiry stage</Label><select id="catering-stage" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={stage} disabled={busy} onChange={event => { const next = event.target.value as CateringStatus; setStage(next); if (closedCatering(next)) setFollowUp(''); }}>
            {stage === 'needs-review' && <option value="needs-review" disabled>Choose a stage</option>}{Object.entries(cateringStatusLabels).filter(([value]) => value !== 'needs-review').map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></div><div className="space-y-2"><Label htmlFor="catering-follow-up">Next follow-up (optional)</Label><Input id="catering-follow-up" type="date" value={followUp} disabled={busy || closedCatering(stage)} onChange={event => setFollowUp(event.target.value)} /></div></div>
          <p className="text-xs text-muted-foreground">{stage === 'confirmed' ? 'Use Confirmed event only after you and the guest have agreed on the details. This does not send a confirmation or collect payment.' : closedCatering(stage) ? 'Closed inquiries stay in your records. Their follow-up date is cleared; choose an active stage to reopen.' : 'Track your conversation here. Changing a stage does not contact the guest.'}</p>
          <div className="space-y-2"><Label htmlFor="catering-notes">Private staff notes</Label><Textarea id="catering-notes" className="min-h-28" value={notes} maxLength={2000} disabled={busy} placeholder="What was discussed, what’s agreed, and what needs to happen next" onChange={event => setNotes(event.target.value)} /><p className="text-xs text-muted-foreground">Visible to staff only · {notes.length}/2,000 characters. Guest requests remain separate.</p></div>
        </form>
        <details className="border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Inquiry history</summary><p className="mt-3 text-xs text-muted-foreground">Received {lead.createdAt ? formatBusinessTimestamp(lead.createdAt, timezone) : 'date not recorded'}</p>{!events.length ? <p className="mt-2 text-xs text-muted-foreground">No history recorded for this older inquiry.</p> : <ol className="mt-3 space-y-3 text-xs">{events.map(event => <li key={event.id} className="border-l-2 pl-3"><p className="font-medium">{event.event === 'catering.created' ? 'Inquiry received' : event.event === 'catering.updated' ? event.previousStatus !== event.status && event.status ? `${event.previousStatus ? cateringStatusLabels[event.previousStatus] : 'Previous stage'} → ${cateringStatusLabels[event.status]}` : 'Staff follow-up updated' : event.event === 'notification.delivered' ? `Receipt email sent to ${event.recipient || 'recipient'}` : event.event.replace(/[._]/g, ' ')}</p>{event.bulkClosed && <p className="mt-1 text-muted-foreground">Closed with the bulk inbox action</p>}{event.notesChanged && <p className="mt-1 text-muted-foreground">Staff notes updated</p>}{event.followUpChanged && <p className="mt-1 text-muted-foreground">{event.followUpDate ? `Follow-up: ${formatDateForDisplay(event.followUpDate, timezone)}` : 'Follow-up cleared'}</p>}<p className="mt-1 text-muted-foreground">{event.timestamp ? formatBusinessTimestamp(event.timestamp, timezone) : 'Time not recorded'}</p></li>)}</ol>}</details>
      </>}
    </div>
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-5 py-4 sm:px-6"><p className="text-xs text-muted-foreground">{dirty ? 'Unsaved changes' : 'Staff workspace'}</p><div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={close}>Close inquiry</Button><Button type="submit" form="catering-update" disabled={loading || busy || !lead || !dirty || stage === 'needs-review'}>{busy ? 'Saving…' : 'Save inquiry'}</Button></div></div>
  </DialogContent></Dialog>;
}
