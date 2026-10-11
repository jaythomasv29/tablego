'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import GuestHistory from './GuestHistory';
import { guestProfiles, type ServiceReservation } from '@/lib/reservations/service';
import { formatBusinessTimestamp } from '@/utils/dateUtils';
interface Event { id: string; event: string; actor: string; timestamp: string | null; channel?: string; recipient?: string }
export default function BookingDetails({ booking, profile, timezone }: { booking: ServiceReservation; profile: ReturnType<typeof guestProfiles>[number]; timezone: string }) {
  const [dietaryPreferences, setDietaryPreferences] = useState(''), [seatingPreference, setSeatingPreference] = useState('');
  const [events, setEvents] = useState<Event[]>([]), [notes, setNotes] = useState(''), [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const endpoint = `/api/staff/reservations/${encodeURIComponent(booking.id)}/history`;
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(endpoint, { cache: 'no-store' }), data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load history');
      setDietaryPreferences(data.dietaryPreferences); setSeatingPreference(data.seatingPreference); setEvents(data.events); setNotes(data.internalNotes); setVersion(data.noteVersion);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, [endpoint]);
  useEffect(() => { void load(); }, [load]);
  async function save() {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ internalNotes: notes, dietaryPreferences, seatingPreference, noteVersion: version }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to save notes');
      await load(); setNotice('Staff notes saved. They are never shown on the guest management page.');
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6 rounded-xl border bg-muted/30 p-4">
    <GuestHistory profile={profile} />
    <section className="space-y-3" aria-label="Private staff notes">
      <Label htmlFor={`note-${booking.id}`}>Internal staff notes</Label>
      <textarea id={`note-${booking.id}`} className="min-h-24 w-full rounded-md border bg-background p-3 text-sm" maxLength={2000} value={notes} disabled={loading || busy} onChange={event => setNotes(event.target.value)} />
      <p className="text-xs text-muted-foreground">For this booking only. Guest requests are kept separately. {notes.length}/2,000 characters.</p>
      <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor={`dietary-${booking.id}`}>Guest-stated dietary preferences</Label><input id={`dietary-${booking.id}`} className="w-full rounded-md border bg-background p-2" maxLength={300} value={dietaryPreferences} disabled={loading || busy} onChange={event => setDietaryPreferences(event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor={`seating-${booking.id}`}>Preferred seating</Label><input id={`seating-${booking.id}`} className="w-full rounded-md border bg-background p-2" maxLength={200} value={seatingPreference} disabled={loading || busy} onChange={event => setSeatingPreference(event.target.value)} /></div></div>
      <p className="text-xs text-muted-foreground">Record preferences the guest explicitly shared. These remain private staff details on this booking; seating is not guaranteed.</p>
      <div className="flex flex-wrap gap-2"><Button size="sm" disabled={loading || busy} onClick={save}>{busy ? 'Saving…' : 'Save staff notes'}</Button><Button size="sm" variant="outline" disabled={busy} onClick={load}>Reload saved notes and timeline</Button></div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}{notice && <p role="status" className="text-sm">{notice}</p>}
    </section>
    <section className="space-y-3" aria-label="Booking timeline"><h3 className="font-semibold">Booking timeline</h3>
      {loading ? <p role="status">Loading history…</p> : !events.length ? <p className="text-sm text-muted-foreground">No timeline events recorded for this legacy booking.</p> : <ol className="space-y-2 text-sm">{events.map(event => <li key={event.id} className="border-t pt-2">
        <p>{event.event.replace(/^reservation\.|^notification\./, '').replace(/[._]/g, ' ')} · {event.actor}{event.channel ? ` · ${event.channel} to ${event.recipient}` : ''}</p>
        <p className="text-xs text-muted-foreground">{event.timestamp ? formatBusinessTimestamp(event.timestamp, timezone) : 'Timestamp not recorded'}</p>
      </li>)}</ol>}
    </section>
  </div>;
}
