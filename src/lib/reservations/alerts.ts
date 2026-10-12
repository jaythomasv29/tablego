import type { ServiceReservation } from './service.ts';
// Establish a baseline from the first server snapshot. Updates and reconnects
// must not sound like new bookings; cached snapshots never establish a baseline.
export function newReservationIds(seen: Set<string> | null, bookings: Pick<ServiceReservation, 'id' | 'status'>[]) {
  if (!seen) return [];
  return bookings.filter(booking => !seen.has(booking.id) && ['pending', 'confirmed', 'needs-review'].includes(booking.status)).map(booking => booking.id);
}
