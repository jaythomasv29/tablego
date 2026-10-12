'use client';
import { useTimezone } from '@/contexts/TimezoneContext';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatReadableDatePST } from '@/utils/dateUtils';
import { restaurantClock } from '@/lib/reservations/availability';
import { Label } from '@/components/ui/label';
import { statusLabels, isGuestEditable, type BookingState } from '@/lib/reservations/domain';
import { CalendarDays, Clock, Users, MapPin, ArrowUpRight } from 'lucide-react';
import ReservationMoment from '@/components/reservations/ReservationMoment';
import ShareReservation from '@/components/reservations/ShareReservation';
import { Textarea } from '@/components/ui/textarea';
import { cancellationReasons } from '@/lib/reservations/guestChanges';

interface Reservation { autoConfirmReservations: boolean; id: string; name: string; date: string; time: string; guests: number; status: BookingState; guestAcknowledged: boolean; comments: string; cancellationReason?: string; timezone: string; version: number }
export default function ManageReservation({ id, initialAction }: { id: string; initialAction?: 'cancel' | 'reschedule' }) {
  const { restaurant } = useTimezone();
  const [token, setToken] = useState(''), [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [loadUnavailable, setLoadUnavailable] = useState(false), [slotsUnavailable, setSlotsUnavailable] = useState(false);
  const [phone, setPhone] = useState(''), [code, setCode] = useState(''), [codeSent, setCodeSent] = useState(false), [codeLength, setCodeLength] = useState(4);
  const [editing, setEditing] = useState(initialAction === 'reschedule'), [cancelOpen, setCancelOpen] = useState(initialAction === 'cancel');
  const [date, setDate] = useState(''), [time, setTime] = useState(''), [slots, setSlots] = useState<string[]>([]), [slotsLoading, setSlotsLoading] = useState(false);
  const [guests, setGuests] = useState(''), [comments, setComments] = useState('');
  const [reasonCode, setReasonCode] = useState(''), [reasonDetails, setReasonDetails] = useState('');
  function resetDraft(value: Reservation) { setDate(value.date); setTime(value.time); setGuests(String(value.guests)); setComments(value.comments || ''); }
  const load = useCallback(async (accessToken: string) => {
    setLoading(true); setError(''); setLoadUnavailable(true);
    try {
      const response = await fetch(`/api/reservations/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) { setLoadUnavailable(response.status !== 403); throw new Error(body.error); }
      setReservation(body.reservation); setDate(body.reservation.date); setTime(body.reservation.time); setGuests(String(body.reservation.guests)); setComments(body.reservation.comments || ''); setLoadUnavailable(false);
    } catch (err) { setReservation(null); if (err instanceof TypeError) setLoadUnavailable(true); setError((err as Error).message || 'Unable to load reservation. Please try again.'); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => {
    const access = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
    setToken(access);
    if (access) void load(access); else setLoading(false);
  }, [load]);
  useEffect(() => {
    if (!editing || !date) return;
    const controller = new AbortController();
    setSlotsLoading(true); setSlots([]); setSlotsUnavailable(false);
    fetch(`/api/availability/settings?date=${encodeURIComponent(date)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data.slots; })
      .then(data => { if (!controller.signal.aborted) setSlots(data.map((slot: { time: string }) => slot.time)); })
      .catch(() => { if (!controller.signal.aborted) setSlotsUnavailable(true); })
      .finally(() => { if (!controller.signal.aborted) setSlotsLoading(false); });
    return () => controller.abort();
  }, [date, editing]);
  async function act(action: string) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/reservations/${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, version: reservation?.version, ...(action === 'reschedule' ? { date, time, guests: Number(guests), comments } : {}), ...(action === 'cancel' ? { cancellationReasonCode: reasonCode, cancellationReasonDetails: reasonCode === 'other' ? reasonDetails : '' } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setReservation(data.reservation); resetDraft(data.reservation); setEditing(false); setCancelOpen(false); setReasonCode(''); setReasonDetails('');
      setNotice(action === 'acknowledge' ? 'Your response is saved. The restaurant can see that you plan to come.' : action === 'cancel' ? 'Your reservation is cancelled.' : data.reservation.status === 'confirmed' ? 'Your change is saved and confirmed.' : 'Your change is saved and awaits restaurant acceptance.');
    } catch (err) { setError((err as Error).message || 'Unable to save. Your current reservation is unchanged.'); }
    finally { setBusy(false); }
  }
  async function recover() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (!codeSent) {
        const response = await fetch('/api/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error);
        setCodeLength(Number.isInteger(data.codeLength) && data.codeLength >= 4 && data.codeLength <= 10 ? data.codeLength : 4); setCodeSent(true); setNotice('Enter the verification code sent to your phone.'); return;
      }
      const verification = await fetch('/api/otp/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code }) });
      const proof = await verification.json(); if (!verification.ok || !proof.valid) throw new Error(proof.error || 'Incorrect or expired verification code.');
      const response = await fetch(`/api/reservations/${encodeURIComponent(id)}/recover`, { method: 'POST' });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      const access = new URL(data.managementUrl).hash;
      window.history.replaceState(null, '', `${window.location.pathname}${access}`);
      const value = new URLSearchParams(access.slice(1)).get('token')!;
      setToken(value); setNotice('Access restored. A secure link has also been queued for your email.'); await load(value);
    } catch (err) { setError((err as Error).message || 'Unable to recover access. Please call the restaurant.'); }
    finally { setBusy(false); }
  }
  return <main className="guest-management reservation-management min-h-screen bg-[#F9F7F2] px-4 py-8 sm:py-14">
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-3"><Link href="/" className="inline-block text-xs uppercase tracking-[0.18em] text-zinc-600">{restaurant.shortName} · {restaurant.location}</Link><span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Your booking</span></div>
      <Card className="reservation-ticket gap-0 overflow-hidden rounded-[1.75rem] border-zinc-900/10 py-0">
        <CardHeader className="reservation-hero relative isolate bg-[#121212] px-6 pb-9 pt-5 text-center sm:px-10 sm:pb-11 sm:pt-7">
          <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-[#A3B18A]">{restaurant.shortName} · Reservations</p>
          <ReservationMoment status={reservation?.status} />
          <CardTitle className="font-normal text-[#F9F7F2]"><h1 className="text-4xl italic leading-tight sm:text-5xl" style={{ fontFamily: 'var(--font-editorial), Georgia, serif' }}>{reservation?.status === 'confirmed' ? 'Your table is confirmed.' : reservation?.status === 'pending' ? 'Your table request.' : reservation?.status === 'cancelled' ? 'Reservation cancelled.' : 'Your reservation.'}</h1></CardTitle>
          <p className="pt-3 text-sm leading-relaxed text-[#F9F7F2]/75">{reservation?.status === 'confirmed' ? 'Good food. Good company. We’ll save you a seat.' : reservation?.status === 'pending' ? 'A little something to look forward to, once your request is accepted.' : 'Your plans, with all the details in one place.'}</p>
          <span className="mx-auto mt-5 h-0.5 w-12 bg-[#A3B18A]" aria-hidden="true" />
        </CardHeader><CardContent className="space-y-6 p-6 sm:p-8">
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {error && reservation && <Button variant="outline" disabled={busy} onClick={() => load(token)}>Reload latest booking</Button>}
        {notice && <p role="status" className="break-words rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
        {loading ? <p role="status">Loading your reservation…</p> : reservation ? <>
          <div className="reservation-details relative space-y-5 rounded-2xl bg-[#EAE0D5] p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#586747]">Reserved for</p>
            <p className="mt-2 break-words text-3xl italic" style={{ fontFamily: 'var(--font-editorial), Georgia, serif' }}>{reservation.name}</p></div>
            <p className="inline-block rounded-full border border-zinc-900/15 bg-white/60 px-3 py-1 text-xs font-medium">{statusLabels[reservation.status]}</p>
            </div>
            <div className="space-y-4 border-t border-zinc-900/10 pt-5"><div className="flex items-start gap-3"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#586747]" aria-hidden="true" /><div><p className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">The day</p><p className="mt-1 text-base font-medium">{formatReadableDatePST(reservation.date, reservation.timezone)}</p></div></div>
              <div className="grid grid-cols-2 gap-4"><div className="flex items-start gap-3"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#586747]" aria-hidden="true" /><div><p className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">Arrival</p><p className="mt-1 text-xl font-medium tabular-nums">{reservation.time}</p></div></div><div className="flex items-start gap-3"><Users className="mt-0.5 h-4 w-4 shrink-0 text-[#586747]" aria-hidden="true" /><div><p className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">Your party</p><p className="mt-1 text-xl font-medium">{reservation.guests} <span className="text-sm">{reservation.guests === 1 ? 'guest' : 'guests'}</span></p></div></div></div>
            </div>
            <p className="text-xs leading-relaxed text-zinc-600">Restaurant local time · {reservation.timezone}</p>
            {reservation.guestAcknowledged && <p className="text-sm text-muted-foreground">You told the restaurant you’re coming</p>}
            {reservation.comments && <p className="break-words whitespace-pre-wrap border-t border-zinc-900/10 pt-3 text-sm leading-relaxed"><span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-zinc-600">Your request</span>{reservation.comments}</p>}
            {reservation.status === 'cancelled' && reservation.cancellationReason && <p className="break-words whitespace-pre-wrap border-t border-zinc-900/10 pt-3 text-sm"><span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-zinc-600">Cancellation reason</span>{reservation.cancellationReason}</p>}
          </div>
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${restaurant.name} ${restaurant.address}`)}`} target="_blank" rel="noreferrer" className="flex items-start gap-3 rounded-xl border border-zinc-900/10 px-4 py-4 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#586747]" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="font-medium">{restaurant.name}</p><p className="mt-1 text-xs leading-relaxed text-zinc-600">{restaurant.address}</p></div><ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" /></a>
          {reservation.status === 'pending' && <p className="text-sm text-muted-foreground">Your request is saved. The restaurant still needs to accept it before your table is confirmed.</p>}
          {reservation.status === 'confirmed' && reservation.date >= restaurantClock(reservation.timezone).date && <ShareReservation id={id} token={token} date={reservation.date} time={reservation.time} guests={reservation.guests} timezone={reservation.timezone} disabled={busy || loadUnavailable} preview={process.env.NEXT_PUBLIC_TABLEGO_ENVIRONMENT === 'staging'} onQueued={setNotice} />}
          {isGuestEditable(reservation.status) && <div className="space-y-3">
            {!reservation.guestAcknowledged && <Button className="w-full rounded-full" disabled={busy} onClick={() => act('acknowledge')}>{reservation.status === 'confirmed' ? 'I’m coming' : 'Acknowledge my request'}</Button>}
            <Button variant="outline" className="w-full rounded-full" disabled={busy} onClick={() => { resetDraft(reservation); setEditing(!editing); setError(''); setNotice(''); }}>Edit reservation</Button>
            <Dialog open={cancelOpen} onOpenChange={open => { if (!busy) setCancelOpen(open); }}>
              <DialogTrigger asChild><Button variant="outline" className="w-full rounded-full" disabled={busy}>Cancel reservation</Button></DialogTrigger>
              <DialogContent className="guest-management" showCloseButton={!busy}>
                <DialogTitle>Cancel this reservation?</DialogTitle>
                <DialogDescription>Your booking for {formatReadableDatePST(reservation.date, reservation.timezone)} at {reservation.time} will be cancelled.</DialogDescription>
                <Label htmlFor="cancellation-reason">Reason for cancelling (optional)</Label>
                <select id="cancellation-reason" className="h-10 w-full rounded-md border bg-background px-3 text-sm" disabled={busy} value={reasonCode} onChange={event => { setReasonCode(event.target.value); setReasonDetails(''); }}>
                  <option value="">Choose a reason</option>{cancellationReasons.map(reason => <option key={reason.code} value={reason.code}>{reason.label}</option>)}
                </select>
                {reasonCode === 'other' && <><Label htmlFor="cancellation-details">Your reason</Label><Textarea id="cancellation-details" value={reasonDetails} maxLength={500} disabled={busy} placeholder="Tell us why you’re cancelling" onChange={event => setReasonDetails(event.target.value)} /><p className="text-xs text-muted-foreground">Up to 500 characters.</p></>}
                <Button variant="outline" autoFocus disabled={busy} onClick={() => setCancelOpen(false)}>Keep reservation</Button>
                <Button variant="destructive" disabled={busy || (reasonCode === 'other' && !reasonDetails.trim())} onClick={() => act('cancel')}>{busy ? 'Cancelling…' : 'Yes, cancel reservation'}</Button>
                {error && <p role="alert" className="text-red-800">{error}</p>}
              </DialogContent>
            </Dialog>
          </div>}
          {editing && isGuestEditable(reservation.status) && <form className="space-y-3 rounded-lg border p-4" onSubmit={event => { event.preventDefault(); void act('reschedule'); }}>
            <h2 className="text-lg font-medium">Edit your reservation</h2>
            <Label htmlFor="new-date">Date</Label><Input id="new-date" type="date" min={restaurantClock(reservation.timezone).date} value={date} required disabled={busy} onChange={event => { setDate(event.target.value); setTime(event.target.value === reservation.date ? reservation.time : ''); setError(''); }} />
            <Label htmlFor="new-time">Time</Label><select id="new-time" className="h-10 w-full rounded-md border bg-background px-3" value={time} required disabled={busy || (slotsLoading && date !== reservation.date)} onChange={event => setTime(event.target.value)}>
              <option value="">{slotsLoading ? 'Checking times…' : 'Choose a time'}</option>{slots.map(slot => <option key={slot}>{slot}</option>)}
              {date === reservation.date && !slots.includes(reservation.time) && <option value={reservation.time}>{reservation.time} (current booking)</option>}
            </select>
            {!slotsLoading && slotsUnavailable && <p className="text-sm text-muted-foreground">New times could not be checked. You can still update your party size and requests at the existing time.</p>}
            {!slotsLoading && !slotsUnavailable && !slots.length && <p className="text-sm text-muted-foreground">No new times are available for this date. Keep your existing time or choose another day.</p>}
            <Label htmlFor="new-guests">Party size</Label><Input id="new-guests" type="number" min={1} max={20} step={1} value={guests} required disabled={busy} onChange={event => setGuests(event.target.value)} />
            <Label htmlFor="new-comments">Special requests (optional)</Label><Textarea id="new-comments" value={comments} maxLength={2000} disabled={busy} placeholder="Dietary needs, seating preferences, or anything else we should know" onChange={event => setComments(event.target.value)} />
            <p className="text-xs text-muted-foreground">Up to 2,000 characters. Requests are subject to availability.</p>
            <p className="text-sm text-muted-foreground">{reservation.autoConfirmReservations ? 'Available changes are confirmed immediately.' : 'Changes to the date, time, or party size require restaurant acceptance.'} Your existing booking stays in place if the new time is unavailable.</p>
            <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy || (!(date === reservation.date && time === reservation.time) && (slotsLoading || slotsUnavailable || !slots.includes(time)))}>{busy ? 'Saving…' : 'Save changes'}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => { setEditing(false); resetDraft(reservation); setError(''); }}>Keep current booking</Button></div>
          </form>}
          <p className="text-sm text-muted-foreground">Booking updates are saved immediately. Email or SMS updates may arrive later.</p>
        </> : loadUnavailable ? <div className="space-y-3">
          <p>Your link could not be checked right now. Please retry or call the restaurant.</p>
          <Button disabled={busy} onClick={() => load(token)}>Retry loading reservation</Button>
          <a className="block underline" href={`tel:${restaurant.phone}`}>Call the restaurant</a>
        </div> : <form className="space-y-4" onSubmit={event => { event.preventDefault(); void recover(); }}>
          <p className="text-sm text-muted-foreground">Use the secure link in your latest email, or verify the phone number used for this booking to restore access.</p>
          <Label htmlFor="recovery-phone">Booking phone number</Label><Input id="recovery-phone" type="tel" autoComplete="tel" value={phone} required disabled={codeSent} onChange={event => setPhone(event.target.value)} />
          {codeSent && <><Label htmlFor="recovery-code">Verification code</Label><Input id="recovery-code" inputMode="numeric" pattern={`[0-9]{${codeLength}}`} maxLength={codeLength} minLength={codeLength} autoComplete="one-time-code" value={code} required onChange={event => setCode(event.target.value)} /></>}
          <Button type="submit" disabled={busy}>{busy ? 'Please wait…' : codeSent ? 'Verify and restore access' : 'Send verification code'}</Button>
          {codeSent && <Button variant="ghost" type="button" disabled={busy} onClick={() => { setCodeSent(false); setCode(''); }}>Change number or resend</Button>}
          <p className="text-sm">Need help? <a className="underline" href={`tel:${restaurant.phone}`}>Call the restaurant</a>.</p>
        </form>}
      </CardContent></Card>
      <footer className="space-y-2 text-center text-xs leading-relaxed text-zinc-600">
        <p className="text-lg italic text-zinc-900" style={{ fontFamily: 'var(--font-editorial), Georgia, serif' }}>{restaurant.name}</p>
        <p>{restaurant.address}</p>
        <p><a href={`tel:${restaurant.phone}`} className="underline underline-offset-4">{restaurant.phoneLabel}</a> · <Link href="/" className="underline underline-offset-4">Return to restaurant</Link></p>
      </footer>
    </div>
  </main>;
}
