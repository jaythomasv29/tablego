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
import { guestProfiles, guestKey, arrivalDue, type ServiceReservation } from '@/lib/reservations/service';
import { restaurantClock, timeMinutes } from '@/lib/reservations/availability';
import { formatReadableDatePST, formatBusinessTimestamp } from '@/utils/dateUtils';
import { useReservations } from './useReservations';
import TodaySummary from './TodaySummary';
import BookingDetails from './BookingDetails';
import DeliverySummary from './DeliverySummary';
type Range = 'today' | 'tomorrow' | 'future' | 'past' | 'all' | 'date';
const stateColors: Record<BookingState, string> = { pending: 'border-amber-500 text-amber-700 dark:text-amber-300', confirmed: 'border-green-500 text-green-700 dark:text-green-300', seated: 'border-blue-500 text-blue-700 dark:text-blue-300', completed: 'border-slate-400', cancelled: 'border-red-400 text-red-700 dark:text-red-300', 'no-show': 'border-red-600 text-red-700 dark:text-red-300', 'needs-review': 'border-orange-500 text-orange-700 dark:text-orange-300' };
export default function ServiceConsole({ today = false }: { today?: boolean }) {
  const { bookings, timezone, loading, error } = useReservations();
  const [now, setNow] = useState(new Date()), [range, setRange] = useState<Range>('today'), [date, setDate] = useState('');
  const [search, setSearch] = useState(''), [status, setStatus] = useState('all'), [specialOnly, setSpecialOnly] = useState(false), [largeOnly, setLargeOnly] = useState(false);
  const [details, setDetails] = useState<string | null>(null), [message, setMessage] = useState<{ booking: ServiceReservation; channel: 'email' | 'sms' } | null>(null);
  const [messageBusy, setMessageBusy] = useState(false), [messageError, setMessageError] = useState(''), [notice, setNotice] = useState('');
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(timer); }, []);
  const clock = restaurantClock(timezone, now);
  const tomorrow = new Date(`${clock.date}T12:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);
  const profiles = useMemo(() => new Map(guestProfiles(bookings).map(profile => [profile.key, profile])), [bookings]);
  const visible = bookings.filter(booking => {
    const inRange = range === 'all' || (range === 'today' && booking.date === clock.date) || (range === 'tomorrow' && booking.date === tomorrowKey) ||
      (range === 'future' && booking.date > clock.date) || (range === 'past' && booking.date && booking.date < clock.date) || (range === 'date' && booking.date === date);
    const matches = `${booking.name} ${booking.email} ${booking.phone} ${booking.comments} ${booking.internalNotes}`.toLowerCase().includes(search.toLowerCase().trim());
    return inRange && matches && (status === 'all' || booking.status === status) && (!specialOnly || Boolean(booking.comments.trim())) && (!largeOnly || booking.guests >= 6);
  }).sort((a, b) => a.date.localeCompare(b.date) || (timeMinutes(a.time) ?? 1440) - (timeMinutes(b.time) ?? 1440) || a.name.localeCompare(b.name));
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
  return <AdminLayout><div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
    <header className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-semibold">{today ? 'Today' : 'Reservations'}</h1><Link className="underline" href={today ? '/admin/reservation' : '/admin/home'}>{today ? 'Open full service console' : 'Back to Today'}</Link></div>
      <p className="text-sm text-muted-foreground">{loading || error ? 'Business clock is unavailable while settings load.' : `${formatBusinessTimestamp(now, timezone)} · ${timezone}`}</p>
      <p className="text-sm text-muted-foreground">All dates, arrival times, timestamps and Today filters use the business timezone wherever you are viewing from.</p>
    </header>
    {error ? <p role="alert" className="rounded-xl border border-red-500 p-4">{error}</p> : loading ? <p role="status">Loading reservations…</p> : <>
      {today && <TodaySummary bookings={bookings} timezone={timezone} now={now} />}
      <DeliverySummary />
      {notice && <p role="status" className="rounded-xl border p-3 text-sm">{notice}</p>}
      <section className="space-y-4 rounded-xl border bg-card p-4" aria-label="Reservation filters">
        <div className="flex flex-wrap gap-2">{(['today', 'tomorrow', 'future', 'past', 'all'] as const).map(value => <Button key={value} size="sm" variant={range === value ? 'default' : 'outline'} aria-pressed={range === value} onClick={() => setRange(value)}>{value[0].toUpperCase() + value.slice(1)}</Button>)}</div>
        <div className="grid gap-3 sm:grid-cols-3"><div className="space-y-1"><Label htmlFor="service-search">Search guests or requests</Label><Input id="service-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, contact, request or staff note" /></div>
          <div className="space-y-1"><Label htmlFor="service-status">Booking status</Label><select id="service-status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{Object.entries(statusLabels).map(([state, label]) => <option key={state} value={state}>{label}</option>)}</select></div>
          <div className="space-y-1"><Label htmlFor="service-date">Restaurant calendar date</Label><Input id="service-date" type="date" value={date} onChange={event => { setDate(event.target.value); setRange('date'); }} /></div>
        </div>
        <div className="flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={specialOnly} onChange={event => setSpecialOnly(event.target.checked)} />Special requests</label><label className="flex items-center gap-2"><input type="checkbox" checked={largeOnly} onChange={event => setLargeOnly(event.target.checked)} />Large parties (6+)</label></div>
      </section>
      <section aria-label="Reservation results" className="space-y-4"><h2 className="text-lg font-semibold">{visible.length} {visible.length === 1 ? 'booking' : 'bookings'}</h2>
        {!visible.length && <p className="rounded-xl border p-6 text-muted-foreground">No reservations match these filters.</p>}
        {visible.map(booking => {
          const profile = profiles.get(guestKey(booking))!;
          return <article key={booking.id} className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1"><h3 className="text-lg font-semibold">{booking.name}</h3><p>{booking.date ? formatReadableDatePST(booking.date, timezone) : 'Date needs staff review'} · {booking.time || 'Time needs review'}</p><p className="text-sm text-muted-foreground">{booking.phone || 'No phone'} · {booking.email || 'No email'}</p></div>
              <div className="flex flex-wrap gap-2"><span className="rounded-full border px-3 py-1 text-sm font-medium">{booking.guests} {booking.guests === 1 ? 'guest' : 'guests'}</span><span className={`rounded-full border px-3 py-1 text-sm ${stateColors[booking.status]}`}>{statusLabels[booking.status]}</span></div>
            </div>
            {isGuestEditable(booking.status) && <p className="text-sm text-muted-foreground">Customer response: {booking.guestAcknowledged ? 'Coming — acknowledged through the secure link' : 'No acknowledgement yet'}</p>}
            {booking.needsReview && <p className="text-sm text-orange-700 dark:text-orange-300">Some imported details need review. Contact the guest before acting.</p>}
            {booking.comments && <p className="rounded-md bg-muted p-3 text-sm"><strong>Guest request:</strong> {booking.comments}</p>}
            {booking.internalNotes && <p className="text-sm"><strong>Staff note:</strong> {booking.internalNotes}</p>}
            {profile.noShows > 0 && <p className="text-sm text-red-700 dark:text-red-300">History includes {profile.noShows} no-show{profile.noShows === 1 ? '' : 's'}. Review the guest history.</p>}
            {profile.sharedContact && <p className="text-xs text-amber-700 dark:text-amber-300">Shared contact details · identity needs review</p>}
            {isGuestEditable(booking.status) && arrivalDue(booking, timezone, now) && <p className="text-sm text-amber-700 dark:text-amber-300">Scheduled arrival time has passed. Review before recording attendance.</p>}
            <ReservationActions reservation={{ ...booking, canNoShow: arrivalDue(booking, timezone, now) }} onUpdated={() => {}} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" aria-expanded={details === booking.id} onClick={() => setDetails(details === booking.id ? null : booking.id)}>{details === booking.id ? 'Hide history and notes' : 'History, notes and timeline'}</Button>
              {isGuestEditable(booking.status) && <><Button size="sm" variant="outline" onClick={() => { setMessage({ booking, channel: 'email' }); setMessageError(''); }}>Email reminder</Button><Button size="sm" variant="outline" disabled={!booking.smsOptIn || !booking.phoneVerified} onClick={() => { setMessage({ booking, channel: 'sms' }); setMessageError(''); }}>SMS reminder</Button></>}
            </div>
            <p className="text-xs text-muted-foreground">Created: {booking.createdAt ? formatBusinessTimestamp(booking.createdAt, timezone) : 'Not recorded'} · {booking.phoneVerified ? 'Phone verified by server' : 'Phone not verified'} · {booking.smsOptIn ? 'SMS consent recorded' : 'No SMS consent'}</p>
            {details === booking.id && <BookingDetails booking={booking} profile={profile} timezone={timezone} />}
          </article>;
        })}
      </section>
    </>}
    <Dialog open={Boolean(message)} onOpenChange={open => { if (!open && !messageBusy) setMessage(null); }}><DialogContent showCloseButton={!messageBusy}><DialogTitle>Send a {message?.channel === 'sms' ? 'text' : 'email'} reminder?</DialogTitle><DialogDescription>This sends booking details and a secure management link to the stored {message?.channel === 'sms' ? 'verified, consenting phone' : 'email'} for {message?.booking.name}. Delivery is tracked separately.</DialogDescription><Button variant="outline" autoFocus disabled={messageBusy} onClick={() => setMessage(null)}>Keep without sending</Button><Button disabled={messageBusy} onClick={sendReminder}>{messageBusy ? 'Queuing…' : 'Send reminder'}</Button>{messageError && <p role="alert" className="text-sm text-red-600">{messageError}</p>}</DialogContent></Dialog>
  </div></AdminLayout>;
}
