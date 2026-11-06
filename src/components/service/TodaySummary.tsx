import { Users, Clock3, Armchair, CalendarCheck } from 'lucide-react';
import styles from './ServiceConsole.module.css';
import { todaySummary, type ServiceReservation } from '@/lib/reservations/service';
export default function TodaySummary({ bookings, timezone, now }: { bookings: ServiceReservation[]; timezone: string; now: Date }) {
  const summary = todaySummary(bookings, timezone, now);
  const metrics = [
    { label: 'Guests booked', value: summary.expectedCovers, note: 'Confirmed, seated & completed', icon: Users },
    { label: 'Awaiting confirmation', value: summary.pending, note: `${summary.requestedCovers} guests requested`, icon: Clock3 },
    { label: 'Parties seated', value: summary.seated, note: 'Currently in service', icon: Armchair },
    { label: 'Upcoming arrivals', value: summary.upcoming, note: 'Confirmed parties still to arrive', icon: CalendarCheck },
  ];
  return <section aria-label="Today's service summary" className={styles.metrics}>
    {metrics.map(({label,value,note,icon:Icon}) => <div key={label} className={styles.metric}><div><span>{label}</span><Icon size={16} aria-hidden="true" /></div><strong>{value}</strong><p>{note}</p></div>)}
  </section>;
}
