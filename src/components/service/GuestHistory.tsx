import { statusLabels } from '@/lib/reservations/domain';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { guestProfiles } from '@/lib/reservations/service';
type Profile = ReturnType<typeof guestProfiles>[number];
export default function GuestHistory({ profile }: { profile: Profile }) {
  return <section aria-label="Guest history" className="space-y-3">
    <h3 className="font-semibold">Guest history</h3>
    <p className="text-sm">{profile.requests} booking requests · {profile.completed} completed visits · {profile.cancelled} cancellations · {profile.noShows} no-shows</p>
    {profile.sharedContact && <p className="rounded-md border border-amber-500 bg-amber-50 p-3 text-sm text-amber-950">Shared contact details need review. Other names or contact combinations have separate summaries; check the source bookings before treating them as the same guest.</p>}
    <p className="text-xs text-muted-foreground">Grouped by exact normalized name, email and phone. This is a conservative summary, not verified identity.</p>
    <ul className="space-y-2 text-sm">{[...profile.bookings].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map(booking => <li key={booking.id} className="border-t pt-2">
      {booking.date ? formatDateForDisplay(booking.date) : 'Date needs review'} · {booking.time || 'Time needs review'} · {statusLabels[booking.status]}
      {booking.internalNotes && <p className="mt-1 text-muted-foreground">Staff note: {booking.internalNotes}</p>}
    </li>)}</ul>
    {profile.bookings.length > 10 && <p className="text-xs text-muted-foreground">Showing the 10 most recent bookings; counts include all loaded history.</p>}
  </section>;
}
