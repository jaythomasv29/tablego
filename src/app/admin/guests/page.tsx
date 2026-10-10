'use client';
import { useMemo, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import GuestHistory from '@/components/service/GuestHistory';
import { useReservations } from '@/components/service/useReservations';
import { guestProfiles } from '@/lib/reservations/service';
export default function GuestsPage() {
  const { bookings, timezone, loading, error } = useReservations();
  const [search, setSearch] = useState(''), [open, setOpen] = useState<string | null>(null);
  const profiles = useMemo(() => guestProfiles(bookings), [bookings]);
  const visible = profiles.filter(profile => `${profile.name} ${profile.email} ${profile.phone}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <AdminLayout><div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
    <header className="space-y-2"><h1 className="text-3xl font-semibold">Guests</h1><p className="text-sm text-muted-foreground">Conservative summaries from booking history. All booking dates and times use {timezone}.</p><p className="text-sm text-muted-foreground">Completed visits count only completed service. Requests, cancellations and no-shows remain separate.</p></header>
    {error ? <p role="alert">{error}</p> : loading ? <p role="status">Loading guest history…</p> : <>
      <div className="space-y-2"><Label htmlFor="guest-search">Find a guest</Label><Input id="guest-search" placeholder="Name, email or phone" value={search} onChange={event => setSearch(event.target.value)} /></div>
      <p className="text-sm">{profiles.length} identity groups · {bookings.length} source bookings · {profiles.reduce((sum, profile) => sum + profile.completed, 0)} completed visits</p>
      {!visible.length && <p className="rounded-xl border p-6">No guest history matches this search.</p>}
      <div className="space-y-4">{visible.map(profile => <article key={profile.key} className="space-y-3 rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">{profile.name}</h2><p className="text-sm text-muted-foreground">{profile.email || 'No email'} · {profile.phone || 'No phone'}</p><p className="text-sm">{profile.requests} requests · {profile.completed} completed visits · {profile.cancelled} cancellations · {profile.noShows} no-shows</p>{profile.sharedContact && <p className="text-sm text-amber-700 dark:text-amber-300">Shared contact details need review</p>}<Button size="sm" variant="outline" aria-expanded={open === profile.key} onClick={() => setOpen(open === profile.key ? null : profile.key)}>Review source history</Button>{open === profile.key && <GuestHistory profile={profile} />}</article>)}</div>
    </>}
  </div></AdminLayout>;
}
