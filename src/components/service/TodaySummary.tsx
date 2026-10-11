import { todaySummary, type ServiceReservation } from '@/lib/reservations/service';
export default function TodaySummary({ bookings, timezone, now }: { bookings: ServiceReservation[]; timezone: string; now: Date }) {
  const summary = todaySummary(bookings, timezone, now);
  return <section aria-label="Today's service summary" className="text-sm text-muted-foreground">
    <p><strong className="text-foreground">{summary.expectedCovers} guests booked today</strong> · {summary.seated} {summary.seated === 1 ? 'party' : 'parties'} seated{summary.pending > 0 && ` · ${summary.pending} ${summary.pending === 1 ? 'request' : 'requests'} awaiting confirmation`}</p>
  </section>;
}
