'use client';
import { useEffect, useId, useMemo, useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { Popover } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { statusLabels } from '@/lib/reservations/domain';
import type { ServiceReservation } from '@/lib/reservations/service';
import { mergeActivityReadMarkers, parseActivityReadMarker, readReservationActivity, recentReservationActivity, unreadReservationActivity, type ActivityReadMarker } from '@/lib/reservations/activity';
import { formatBusinessTimestamp, formatReadableDatePST } from '@/utils/dateUtils';

const storageKey = `tablego:reservation-activity:v1:${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'local'}`;

export default function ReservationActivity({ bookings, timezone, synced }: { bookings: ServiceReservation[]; timezone: string; synced: boolean }) {
  const [open, setOpen] = useState(false), [ready, setReady] = useState(false);
  const [read, setRead] = useState<ActivityReadMarker | null>(null);
  const [displayedIds, setDisplayedIds] = useState<string[]>([]);
  const titleId = useId(), descriptionId = useId();
  const recent = useMemo(() => recentReservationActivity(bookings), [bookings]);
  const unread = useMemo(() => unreadReservationActivity(recent, read), [recent, read]);
  const displayed = recent.filter(booking => displayedIds.includes(booking.id));

  useEffect(() => {
    try { setRead(parseActivityReadMarker(localStorage.getItem(storageKey))); } catch { /* Read state can still live in memory. */ }
    setReady(true);
    function syncRead(event: StorageEvent) {
      if (event.key !== storageKey) return;
      const marker = parseActivityReadMarker(event.newValue);
      if (marker) setRead(current => current ? mergeActivityReadMarkers(current, marker) : marker);
    }
    window.addEventListener('storage', syncRead);
    return () => window.removeEventListener('storage', syncRead);
  }, []);

  useEffect(() => {
    if (!ready || !synced || (read && !open)) return;
    if (open && unread.length) setDisplayedIds(current => Array.from(new Set([...current, ...unread.map(booking => booking.id)])));
    const next = readReservationActivity(recent, read);
    if (next === read) return;
    setRead(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Storage restrictions must not block the popup. */ }
  }, [ready, synced, open, recent, read, unread]);

  return <Popover.Root open={open} onOpenChange={next => { setDisplayedIds(next ? unread.map(booking => booking.id) : []); setOpen(next); }}>
    <Popover.Trigger asChild>
      <Button variant="outline" size="icon" className="relative h-10 w-10 shrink-0 rounded-full" disabled={!ready || !synced}
        aria-label={unread.length ? `Reservation activity, ${unread.length} new ${unread.length === 1 ? 'reservation' : 'reservations'}` : 'Reservation activity, up to date'}
        title={!synced ? 'Connecting to reservation activity…' : 'Reservation activity'}>
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unread.length > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{unread.length}</span>}
      </Button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content align="end" sideOffset={10} collisionPadding={12} aria-labelledby={titleId} aria-describedby={descriptionId}
        className="z-50 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl outline-none">
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div><h2 id={titleId} className="font-semibold">Reservation activity</h2><p id={descriptionId} className="mt-1 text-xs text-muted-foreground">New bookings appear here automatically.</p></div>
          <Popover.Close asChild><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Close reservation activity"><X className="h-4 w-4" /></Button></Popover.Close>
        </div>
        <p role="status" className="flex items-center gap-2 border-b px-4 py-2 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5" aria-hidden="true" />{synced ? 'You’re up to date' : 'Reconnecting to live activity…'}</p>
        <div className="max-h-[min(400px,50vh)] overflow-y-auto overscroll-contain">
          {displayed.length ? <ol className="divide-y" aria-label="New reservations">{displayed.map(booking => <li key={booking.id} className="space-y-1 px-4 py-3">
            <div className="flex items-start justify-between gap-3"><p className="min-w-0 break-words text-sm font-medium">{booking.name}</p><span className="shrink-0 text-xs text-muted-foreground">{booking.status === 'pending' ? 'Pending' : booking.status === 'needs-review' ? 'Details incomplete' : statusLabels[booking.status]}</span></div>
            <p className="text-sm">{booking.date ? formatReadableDatePST(booking.date, timezone) : 'Date not recorded'} · {booking.time || 'Time not recorded'}</p>
            <p className="text-xs text-muted-foreground">{booking.guests} {booking.guests === 1 ? 'guest' : 'guests'} · Created {formatBusinessTimestamp(booking.createdAt!, timezone)}</p>
          </li>)}</ol> : <p className="p-5 text-sm text-muted-foreground">New reservations will appear here.</p>}
        </div>
        {displayed.length > 0 && <p className="border-t px-4 py-2 text-xs text-muted-foreground">Restaurant local time</p>}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
