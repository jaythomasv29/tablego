'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import ReservationActions from '@/components/ReservationActions';
import { statusLabels, isGuestEditable, type BookingState } from '@/lib/reservations/domain';
import { guestProfiles, guestKey, arrivalDue, todayService, type ServiceReservation } from '@/lib/reservations/service';
import { restaurantClock, timeMinutes } from '@/lib/reservations/availability';
import { formatReadableDatePST, formatBusinessTimestamp } from '@/utils/dateUtils';
import { useReservations } from './useReservations';
import TodaySummary from './TodaySummary';
import BookingDetails from './BookingDetails';
import DeliverySummary from './DeliverySummary';
import NotificationStatus from '@/components/NotificationStatus';
type Range = 'today' | 'tomorrow' | 'future' | 'past' | 'all' | 'date';
const stateColors: Record<BookingState, string> = { pending: 'border-amber-500 text-amber-700 dark:text-amber-300', confirmed: 'border-green-500 text-green-700 dark:text-green-300', seated: 'border-blue-500 text-blue-700 dark:text-blue-300', completed: 'border-slate-400', cancelled: 'border-red-400 text-red-700 dark:text-red-300', 'no-show': 'border-red-600 text-red-700 dark:text-red-300', 'needs-review': 'border-orange-500 text-orange-700 dark:text-orange-300' };
export default function ServiceConsole({ today = false }: { today?: boolean }) {
  const { bookings, timezone, loading, error } = useReservations({ alerts: true });
  const [now, setNow] = useState(new Date()), [range, setRange] = useState<Range>('today'), [date, setDate] = useState('');
  const [search, setSearch] = useState(''), [status, setStatus] = useState('all'), [specialOnly, setSpecialOnly] = useState(false), [largeOnly, setLargeOnly] = useState(false);
  const [details, setDetails] = useState<string | null>(null), [message, setMessage] = useState<{ booking: ServiceReservation; channel: 'email' | 'sms' } | null>(null);
  const [messageBusy, setMessageBusy] = useState(false), [messageError, setMessageError] = useState(''), [notice, setNotice] = useState('');
  const [smsCapability, setSmsCapability] = useState({ available: false, reason: 'Checking SMS reminder availability…' });
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/staff/communication-capabilities', { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(); setSmsCapability(body.smsReminders); })
      .catch(error => { if (error.name !== 'AbortError') setSmsCapability({ available: false, reason: 'Unable to check SMS reminder availability. Reload to try again.' }); });
    return () => controller.abort();
  }, []);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(timer); }, []);
  const clock = restaurantClock(timezone, now);
  const tomorrow = new Date(`${clock.date}T12:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);
  const profiles = useMemo(() => new Map(guestProfiles(bookings).map(profile => [profile.key, profile])), [bookings]);
  const visible = bookings.filter(booking => {
    const inRange = today ? booking.date === clock.date || (!booking.date && booking.status === 'needs-review') : range === 'all' || (range === 'today' && booking.date === clock.date) || (range === 'tomorrow' && booking.date === tomorrowKey) ||
      (range === 'future' && booking.date > clock.date) || (range === 'past' && booking.date && booking.date < clock.date) || (range === 'date' && booking.date === date);
    const matches = `${booking.name} ${booking.email} ${booking.phone} ${booking.comments} ${booking.internalNotes} ${booking.dietaryPreferences} ${booking.seatingPreference}`.toLowerCase().includes(search.toLowerCase().trim());
    return inRange && matches && (status === 'all' || booking.status === status) && (!specialOnly || Boolean(`${booking.comments}${booking.dietaryPreferences}${booking.seatingPreference}`.trim())) && (!largeOnly || booking.guests >= 6);
  }).sort((a, b) => a.date.localeCompare(b.date) || (timeMinutes(a.time) ?? 1440) - (timeMinutes(b.time) ?? 1440) || a.name.localeCompare(b.name));
  const service = todayService(visible, timezone, now);
  const filtered = Boolean(search.trim() || status !== 'all' || specialOnly || largeOnly);
  async function sendReminder() {
    if (!message || messageBusy) return;
    setMessageBusy(true); setMessageError('');
    try {
      const response = await fetch(message.channel === 'sms' ? '/api/send-sms' : '/api/send-reminder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reservationId: message.booking.id }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to queue reminder');
      setNotice(`${message.channel === 'sms' ? 'SMS' : 'Email'} reminder queued for ${message.booking.name}. Check message delivery for the result.`); setMessage(null);
    } catch (err) { setMessageError((err as Error).message); }
    finally { setMessageBusy(false); }
  }
  function renderBooking(booking: ServiceReservation) {
    const profile = profiles.get(guestKey(booking))!;
    return <article key={booking.id} className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1">
        {today && <p className="text-xl font-semibold tabular-nums">{booking.time || 'Time needs review'} <span className="text-sm font-normal text-muted-foreground">· {booking.guests} {booking.guests === 1 ? 'guest' : 'guests'}</span></p>}
        <h3 className={today ? 'text-base font-semibold' : 'text-lg font-semibold'}>{booking.name}</h3>
        {!today && <p>{booking.date ? formatReadableDatePST(booking.date, timezone) : 'Date needs staff review'} · {booking.time || 'Time needs review'}</p>}
        {today && !booking.date && <p className="text-sm text-orange-700 dark:text-orange-300">Date needs staff review</p>}
        {!today && <p className="text-sm text-muted-foreground">{booking.phone || 'No phone'} · {booking.email || 'No email'}</p>}
      </div><div className="flex flex-wrap gap-2">
        {!today && <span className="rounded-full border px-3 py-1 text-sm font-medium">{booking.guests} {booking.guests === 1 ? 'guest' : 'guests'}</span>}
        {today && booking.guests >= 6 && <span className="rounded-full border px-3 py-1 text-sm">Large party</span>}
        <span className={`rounded-full border px-3 py-1 text-sm ${stateColors[booking.status]}`}>{statusLabels[booking.status]}</span>
      </div></div>
      {booking.needsReview && <p className="text-sm text-orange-700 dark:text-orange-300">Some imported details need review. Contact the guest before acting.</p>}
      {booking.comments && <p className="rounded-md bg-muted p-3 text-sm"><strong>Guest request:</strong> {booking.comments}</p>}
      {booking.internalNotes && <p className="text-sm"><strong>Staff note:</strong> {booking.internalNotes}</p>}
      {booking.dietaryPreferences && <p className="text-sm"><strong>Dietary preference:</strong> {booking.dietaryPreferences}</p>}
      {booking.seatingPreference && <p className="text-sm"><strong>Seating preference:</strong> {booking.seatingPreference}</p>}
      {isGuestEditable(booking.status) && arrivalDue(booking, timezone, now) && <p className="text-sm text-amber-700 dark:text-amber-300">Arrival time reached · check whether the party has arrived.</p>}
      {isGuestEditable(booking.status) && (!today || booking.guestAcknowledged || details === booking.id) && <p className="text-sm text-muted-foreground">Customer response: {booking.guestAcknowledged ? 'Coming — acknowledged through the secure link' : 'No acknowledgement yet'}</p>}
      {profile.noShows > 0 && <p className="text-sm text-red-700 dark:text-red-300">History includes {profile.noShows} no-show{profile.noShows === 1 ? '' : 's'}. Review the guest history.</p>}
      {profile.sharedContact && <p className="text-xs text-amber-700 dark:text-amber-300">Shared contact details · identity needs review</p>}
      <ReservationActions reservation={{ ...booking, canNoShow: arrivalDue(booking, timezone, now) }} showDelivery={!today} onUpdated={() => {}} />
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="ghost" aria-expanded={details === booking.id} onClick={() => setDetails(details === booking.id ? null : booking.id)}>{details === booking.id ? 'Hide details' : today ? 'Details and reminders' : 'History, notes and timeline'}</Button>
        {!today && isGuestEditable(booking.status) && reminderButtons(booking)}
      </div>
      {(!today || details === booking.id) && <p className="text-xs text-muted-foreground">Created: {booking.createdAt ? formatBusinessTimestamp(booking.createdAt, timezone) : 'Not recorded'} · {booking.phoneVerified ? 'Phone verified by server' : 'Phone not verified'} · {booking.smsOptIn ? 'SMS consent recorded' : 'No SMS consent'}</p>}
      {details === booking.id && <>
        {today && <><p className="text-sm">{booking.phone || 'No phone'} · {booking.email || 'No email'}</p>
          {isGuestEditable(booking.status) && <div className="flex flex-wrap gap-2">{reminderButtons(booking)}</div>}
          <NotificationStatus reservationId={booking.id} /></>}
        <BookingDetails booking={booking} profile={profile} timezone={timezone} />
      </>}
    </article>;
  }
  function reminderButtons(booking: ServiceReservation) {
    return <><Button size="sm" variant="outline" onClick={() => { setMessage({ booking, channel: 'email' }); setMessageError(''); }}>Email reminder</Button><Button size="sm" variant="outline" disabled={!smsCapability.available || !booking.smsOptIn || !booking.phoneVerified} title={smsCapability.available ? 'Requires guest consent and a verified phone' : smsCapability.reason} onClick={() => { setMessage({ booking, channel: 'sms' }); setMessageError(''); }}>SMS reminder</Button>{!smsCapability.available && <p className="w-full text-xs text-muted-foreground">{smsCapability.reason}</p>}</>;
  }
  return <AdminLayout><div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
    <header className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-semibold">{today ? 'Today’s service' : 'Reservations'}</h1><Link className="text-sm underline" href={today ? '/admin/reservation' : '/admin/home'}>{today ? 'All reservations' : 'Back to Today'}</Link></div>
      <p className="text-sm text-muted-foreground">{loading || error ? 'Business clock is unavailable while settings load.' : `${formatBusinessTimestamp(now, timezone)} · ${timezone}`}</p>
      {!today && <p className="text-sm text-muted-foreground">All dates, arrival times, timestamps and Today filters use the business timezone wherever you are viewing from.</p>}
      {today && !loading && !error && <TodaySummary bookings={bookings} timezone={timezone} now={now} />}
    </header>
    {error ? <p role="alert" className="rounded-xl border border-red-500 p-4">{error}</p> : loading ? <p role="status">Loading reservations…</p> : <>
      {!today && <DeliverySummary />}
      {notice && <p role="status" className="rounded-xl border p-3 text-sm">{notice}</p>}
      {!today && <section className="space-y-4 rounded-xl border bg-card p-4" aria-label="Reservation filters">
        <div className="flex flex-wrap gap-2">{(['today', 'tomorrow', 'future', 'past', 'all'] as const).map(value => <Button key={value} size="sm" variant={range === value ? 'default' : 'outline'} aria-pressed={range === value} onClick={() => setRange(value)}>{value[0].toUpperCase() + value.slice(1)}</Button>)}</div>
        <div className="grid gap-3 sm:grid-cols-3"><div className="space-y-1"><Label htmlFor="service-search">Search guests or requests</Label><Input id="service-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, contact, request or staff note" /></div>
          <div className="space-y-1"><Label htmlFor="service-status">Booking status</Label><select id="service-status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{Object.entries(statusLabels).map(([state, label]) => <option key={state} value={state}>{label}</option>)}</select></div>
          <div className="space-y-1"><Label htmlFor="service-date">Restaurant calendar date</Label><Input id="service-date" type="date" value={date} onChange={event => { setDate(event.target.value); setRange('date'); }} /></div>
        </div>
        <div className="flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={specialOnly} onChange={event => setSpecialOnly(event.target.checked)} />Special requests</label><label className="flex items-center gap-2"><input type="checkbox" checked={largeOnly} onChange={event => setLargeOnly(event.target.checked)} />Large parties (6+)</label></div>
      </section>}
      {today ? <>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 space-y-1"><Label htmlFor="today-search">Find a guest or request</Label><Input id="today-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search today’s service" /></div>
          {filtered && <Button variant="outline" onClick={() => { setSearch(''); setStatus('all'); setSpecialOnly(false); setLargeOnly(false); }}>Clear filters</Button>}
        </div>
        <details className="rounded-xl border px-4 py-3"><summary className="cursor-pointer text-sm font-medium">Filter today’s service{filtered ? ' · filters active' : ''}</summary>
          <div className="mt-4 flex flex-wrap items-end gap-4"><div className="space-y-1"><Label htmlFor="today-status">Booking status</Label><select id="today-status" className="h-10 rounded-md border bg-background px-3 text-sm" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{Object.entries(statusLabels).map(([state, label]) => <option key={state} value={state}>{label}</option>)}</select></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={specialOnly} onChange={event => setSpecialOnly(event.target.checked)} />Special requests</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={largeOnly} onChange={event => setLargeOnly(event.target.checked)} />Large parties (6+)</label>
          </div>
        </details>
        {filtered && <p role="status" className="text-sm text-muted-foreground">Showing {visible.length} matching {visible.length === 1 ? 'booking' : 'bookings'}. Clear filters to see the whole service.</p>}
        {service.attention.length > 0 && <section aria-label="Needs attention" className="space-y-3"><div><h2 className="text-lg font-semibold">Needs attention <span className="text-muted-foreground">· {service.attention.length}</span></h2><p className="text-sm text-muted-foreground">Arrivals due, requests awaiting confirmation, or details to review.</p></div>{service.attention.map(renderBooking)}</section>}
        <section aria-label="Arriving in the next hour" className="space-y-3"><div><h2 className="text-lg font-semibold">Arriving in the next hour</h2><p className="text-sm text-muted-foreground">Confirmed parties, in arrival order.</p></div>
          {service.arriving.length ? service.arriving.map(renderBooking) : <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">{filtered ? 'No matching arrivals in the next hour.' : 'No confirmed arrivals in the next hour.'}</p>}
        </section>
        {service.seated.length > 0 && <section aria-label="Seated now" className="space-y-3"><h2 className="text-lg font-semibold">Seated now <span className="text-muted-foreground">· {service.seated.length} {service.seated.length === 1 ? 'party' : 'parties'}</span></h2>{service.seated.map(renderBooking)}</section>}
        {service.later.length > 0 && <section aria-label="Later today" className="space-y-3"><h2 className="text-lg font-semibold">Later today</h2>{service.later.map(renderBooking)}</section>}
        {!visible.length && !filtered && <p className="text-sm text-muted-foreground">No reservations booked for today. Walk-ins are not included here.</p>}
        {service.finished.length > 0 && <details className="rounded-xl border p-4"><summary className="cursor-pointer font-medium">Finished and cancelled · {service.finished.length}</summary><div className="mt-4 space-y-3">{service.finished.map(renderBooking)}</div></details>}
        <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Message delivery tools</summary><div className="mt-4"><DeliverySummary /></div></details>
      </> : <section aria-label="Reservation results" className="space-y-4"><h2 className="text-lg font-semibold">{visible.length} {visible.length === 1 ? 'booking' : 'bookings'}</h2>
        {!visible.length && <p className="rounded-xl border p-6 text-muted-foreground">No reservations match these filters.</p>}
        {visible.map(renderBooking)}
      </section>}
    </>}
    <Dialog open={Boolean(message)} onOpenChange={open => { if (!open && !messageBusy) setMessage(null); }}><DialogContent showCloseButton={!messageBusy}><DialogTitle>Send a {message?.channel === 'sms' ? 'text' : 'email'} reminder?</DialogTitle><DialogDescription>This sends booking details and a secure management link to the stored {message?.channel === 'sms' ? 'verified, consenting phone' : 'email'} for {message?.booking.name}. Delivery is tracked separately.</DialogDescription><Button variant="outline" autoFocus disabled={messageBusy} onClick={() => setMessage(null)}>Keep without sending</Button><Button disabled={messageBusy} onClick={sendReminder}>{messageBusy ? 'Queuing…' : 'Send reminder'}</Button>{messageError && <p role="alert" className="text-sm text-red-600">{messageError}</p>}</DialogContent></Dialog>
  </div></AdminLayout>;
}
