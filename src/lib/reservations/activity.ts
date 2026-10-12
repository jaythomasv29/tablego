import type { ServiceReservation } from './service.ts';

export interface ActivityReadMarker { at: number; ids: string[] }
type ActivityBooking = Pick<ServiceReservation, 'id' | 'createdAt'>;
const created = (booking: ActivityBooking) => Date.parse(booking.createdAt || '');

// Arrival dates and booking status never determine whether a creation is new.
export function recentReservationActivity<T extends ActivityBooking>(bookings: T[]): T[] {
  return bookings.filter(booking => Number.isFinite(created(booking)))
    .sort((a, b) => created(b) - created(a) || a.id.localeCompare(b.id)).slice(0, 50);
}

export function unreadReservationActivity<T extends ActivityBooking>(bookings: T[], marker: ActivityReadMarker | null): T[] {
  if (!marker) return []; // First visit establishes a baseline, without historical alerts.
  return bookings.filter(booking => created(booking) > marker.at ||
    (created(booking) === marker.at && !marker.ids.includes(booking.id)));
}

export function mergeActivityReadMarkers(a: ActivityReadMarker, b: ActivityReadMarker): ActivityReadMarker {
  if (a.at !== b.at) return a.at > b.at ? a : b;
  const ids = Array.from(new Set([...a.ids, ...b.ids])).sort();
  return ids.length === a.ids.length ? a : { at: a.at, ids };
}

export function readReservationActivity(bookings: ActivityBooking[], marker: ActivityReadMarker | null): ActivityReadMarker {
  let result = marker || { at: 0, ids: [] };
  for (const booking of bookings) {
    const at = created(booking);
    if (Number.isFinite(at)) result = mergeActivityReadMarkers(result, { at, ids: [booking.id] });
  }
  return result;
}

export function parseActivityReadMarker(value: string | null): ActivityReadMarker | null {
  try {
    const marker = JSON.parse(value || 'null');
    if (!marker || !Number.isSafeInteger(marker.at) || marker.at < 0 || !Array.isArray(marker.ids) ||
        marker.ids.length > 1000 || marker.ids.some((id: unknown) => typeof id !== 'string' || id.length > 128)) return null;
    return { at: marker.at, ids: Array.from(new Set<string>(marker.ids)).sort() };
  } catch { return null; }
}
