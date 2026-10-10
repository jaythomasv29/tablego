import { todaySummary, type ServiceReservation } from '@/lib/reservations/service';
export default function TodaySummary({ bookings, timezone, now }: { bookings: ServiceReservation[]; timezone: string; now: Date }) {
  const summary = todaySummary(bookings, timezone, now);
  const items = [ ['Accepted covers', summary.expectedCovers], ['Pending requests', summary.pending], ['Upcoming arrivals', summary.upcoming],
    ['Seated', summary.seated], ['Completed visits', summary.completed], ['Cancelled', summary.cancelled], ['Special requests', summary.specialRequests],
    ['Large parties (6+)', summary.largeParties], ['Arrivals needing review', summary.overdue], ['No-shows', summary.noShows] ];
  return <section aria-label="Today's service summary" className="space-y-3">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{items.map(([label, value]) => <div key={label} className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>)}</div>
    <p className="text-sm text-muted-foreground">{summary.requestedCovers} covers requested in pending bookings. Availability currently follows business hours; table capacity is not configured.</p>
  </section>;
}
