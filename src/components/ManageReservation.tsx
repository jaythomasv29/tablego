'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { statusLabels, isGuestEditable, type BookingState } from '@/lib/reservations/domain';

interface Reservation { id: string; name: string; date: string; time: string; guests: number; status: BookingState; guestAcknowledged: boolean; comments: string; version: number }
export default function ManageReservation({ id, initialAction }: { id: string; initialAction?: 'cancel' | 'reschedule' }) {
  const [token, setToken] = useState(''), [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [phone, setPhone] = useState(''), [code, setCode] = useState(''), [codeSent, setCodeSent] = useState(false);
  const [editing, setEditing] = useState(initialAction === 'reschedule'), [cancelOpen, setCancelOpen] = useState(false);
  const [date, setDate] = useState(''), [time, setTime] = useState(''), [slots, setSlots] = useState<string[]>([]), [slotsLoading, setSlotsLoading] = useState(false);
  const load = useCallback(async (accessToken: string) => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/reservations/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setReservation(body.reservation); setDate(body.reservation.date); setTime(body.reservation.time);
    } catch (err) { setReservation(null); setError((err as Error).message || 'Unable to load reservation. Please try again.'); }
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
    setSlotsLoading(true); setSlots([]);
    fetch(`/api/availability/settings?date=${encodeURIComponent(date)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data.slots; })
      .then(data => setSlots(data.map((slot: { time: string }) => slot.time)))
      .catch(err => { if (!controller.signal.aborted) setError(err.message || 'Unable to verify availability.'); })
      .finally(() => { if (!controller.signal.aborted) setSlotsLoading(false); });
    return () => controller.abort();
  }, [date, editing]);
  async function act(action: string) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/reservations/${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, date, time, version: reservation?.version }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setReservation(data.reservation); setEditing(false); setCancelOpen(false);
      setNotice(action === 'acknowledge' ? 'Your plans are acknowledged. Restaurant acceptance is shown below.' : action === 'cancel' ? 'Your reservation is cancelled.' : 'Your change is saved and awaits restaurant acceptance.');
    } catch (err) { setError((err as Error).message || 'Unable to save. Your current reservation is unchanged.'); }
    finally { setBusy(false); }
  }
  async function recover() {
    setBusy(true); setError('');
    try {
      if (!codeSent) {
        const response = await fetch('/api/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error);
        setCodeSent(true); setNotice('Enter the verification code sent to your phone.'); return;
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
  return <main className="guest-management min-h-screen bg-[#F9F7F2] px-4 py-12 sm:py-20">
    <div className="mx-auto max-w-xl space-y-6">
      <Link href="/" className="text-sm font-medium">Thaiphoon · Palo Alto</Link>
      <Card><CardHeader><CardTitle className="text-2xl">Manage your reservation</CardTitle></CardHeader><CardContent className="space-y-6">
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
        {loading ? <p role="status">Loading your reservation…</p> : reservation ? <>
          <div className="rounded-lg bg-muted p-5 space-y-2">
            <p className="font-semibold">{reservation.name}</p><p>{new Date(`${reservation.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</p>
            <p>{reservation.time} · {reservation.guests} {reservation.guests === 1 ? 'guest' : 'guests'}</p>
            <p className="font-medium">{statusLabels[reservation.status]}</p>
            {reservation.guestAcknowledged && <p className="text-sm text-muted-foreground">Guest plans acknowledged</p>}
            {reservation.comments && <p className="text-sm">{reservation.comments}</p>}
          </div>
          {reservation.status === 'pending' && <p className="text-sm text-muted-foreground">Your request is saved. The restaurant still needs to accept it before your table is confirmed.</p>}
          {isGuestEditable(reservation.status) && <div className="space-y-3">
            {!reservation.guestAcknowledged && <Button className="w-full" disabled={busy} onClick={() => act('acknowledge')}>Acknowledge my plans</Button>}
            <Button variant="outline" className="w-full" disabled={busy} onClick={() => { setEditing(!editing); setError(''); }}>Reschedule</Button>
            <Button variant="outline" className="w-full" disabled={busy} onClick={() => setCancelOpen(true)}>Cancel reservation</Button>
          </div>}
          {editing && isGuestEditable(reservation.status) && <form className="space-y-3 rounded-lg border p-4" onSubmit={event => { event.preventDefault(); void act('reschedule'); }}>
            <Label htmlFor="new-date">New date</Label><Input id="new-date" type="date" value={date} required onChange={event => { setDate(event.target.value); setTime(''); setError(''); }} />
            <Label htmlFor="new-time">New time</Label><select id="new-time" className="h-10 w-full rounded-md border bg-background px-3" value={time} required disabled={slotsLoading} onChange={event => setTime(event.target.value)}>
              <option value="">{slotsLoading ? 'Checking times…' : 'Choose a time'}</option>{slots.map(slot => <option key={slot}>{slot}</option>)}
            </select>
            {!slotsLoading && !slots.length && <p className="text-sm text-muted-foreground">No times are available for this date. Choose another day or call the restaurant.</p>}
            <p className="text-sm text-muted-foreground">Changes require restaurant acceptance. Your existing booking stays in place if the new time is unavailable.</p>
            <Button type="submit" disabled={busy || slotsLoading || !slots.includes(time)}>{busy ? 'Saving…' : 'Request this change'}</Button>
          </form>}
          {cancelOpen && <div role="alert" className="space-y-3 rounded-lg border p-4"><p>Cancel this reservation?</p><div className="flex flex-wrap gap-3"><Button variant="destructive" disabled={busy} onClick={() => act('cancel')}>{busy ? 'Cancelling…' : 'Yes, cancel reservation'}</Button><Button variant="outline" disabled={busy} onClick={() => setCancelOpen(false)}>Keep reservation</Button></div></div>}
        </> : <form className="space-y-4" onSubmit={event => { event.preventDefault(); void recover(); }}>
          <p className="text-sm text-muted-foreground">Use the secure link in your latest email, or verify the phone number used for this booking to restore access.</p>
          <Label htmlFor="recovery-phone">Booking phone number</Label><Input id="recovery-phone" type="tel" autoComplete="tel" value={phone} required disabled={codeSent} onChange={event => setPhone(event.target.value)} />
          {codeSent && <><Label htmlFor="recovery-code">Verification code</Label><Input id="recovery-code" inputMode="numeric" autoComplete="one-time-code" value={code} required onChange={event => setCode(event.target.value)} /></>}
          <Button type="submit" disabled={busy}>{busy ? 'Please wait…' : codeSent ? 'Verify and restore access' : 'Send verification code'}</Button>
          {codeSent && <Button variant="ghost" type="button" disabled={busy} onClick={() => { setCodeSent(false); setCode(''); }}>Change number or resend</Button>}
          <p className="text-sm">Need help? <a className="underline" href="tel:+16503237700">Call the restaurant</a>.</p>
        </form>}
      </CardContent></Card>
      <Link href="/" className="inline-block text-sm underline">Return to restaurant</Link>
    </div>
  </main>;
}
