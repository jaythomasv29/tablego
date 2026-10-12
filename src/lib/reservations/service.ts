import { getLocalDateString } from '../../utils/dateUtils.ts';
import { bookingState, type BookingState } from './domain.ts';
import { restaurantClock, timeMinutes, displayTime } from './availability.ts';
export interface ServiceReservation {
  completedAt?: string | null; followUpSent?: boolean; followUpEventId?: string; feedbackReceivedAt?: string | null; feedbackSentiment?: string; privateFeedback?: string;
  id: string; date: string; time: string; name: string; email: string; phone: string; guests: number;
  status: BookingState; needsReview: boolean; comments: string; internalNotes: string; createdAt: string | null;
  dietaryPreferences: string; seatingPreference: string; preferencesUpdatedAt: string | null;
  guestAcknowledged: boolean; phoneVerified: boolean; smsOptIn: boolean; noteVersion: number; marked: boolean;
}
export function timestampString(value: unknown): string | null {
  try {
    const date = value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function' ? value.toDate() : value;
    if (!(date instanceof Date) && typeof date !== 'string') return null;
    if (typeof date === 'string' && !/(Z|[+-]\d{2}:?\d{2}|GMT.*)$/i.test(date)) return null;
    const parsed = new Date(date);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  } catch { return null; }
}
const text = (value: unknown, limit = 2000) => typeof value === 'string' ? value.slice(0, limit) : '';
export function serviceReservation(id: string, record: Record<string, unknown>, timezone: string): ServiceReservation {
  let date = '', status = bookingState(record), needsReview = status === 'needs-review';
  try { date = getLocalDateString(record.date, timezone); } catch { needsReview = true; }
  const minutes = timeMinutes(record.time);
  if (minutes === null || !Number.isInteger(record.guests) || Number(record.guests) < 1) needsReview = true;
  if (needsReview && !['cancelled', 'no-show', 'completed'].includes(status)) status = 'needs-review';
  return { completedAt: timestampString(record.completedAt), followUpSent: record.followUpSent === true, followUpEventId: text(record.followUpEventId, 128), feedbackReceivedAt: timestampString(record.feedbackReceivedAt || record.privateFeedbackAt || record.feedbackRespondedAt), feedbackSentiment: text(record.feedbackSentiment, 30), privateFeedback: text(record.privateFeedback), id, date, time: minutes === null ? text(record.time, 30) : displayTime(minutes), name: text(record.name, 120) || 'Guest name missing',
    email: text(record.email, 254), phone: text(record.phone, 40), guests: Number.isInteger(record.guests) && Number(record.guests) > 0 ? Number(record.guests) : 0,
    dietaryPreferences: text(record.dietaryPreferences, 300), seatingPreference: text(record.seatingPreference, 200), preferencesUpdatedAt: timestampString(record.preferencesUpdatedAt),
    status, needsReview, comments: text(record.comments), internalNotes: text(record.internalNotes), createdAt: timestampString(record.createdAt),
    guestAcknowledged: Boolean(timestampString(record.guestAcknowledgedAt)), phoneVerified: record.phoneVerified === true && record.phoneVerificationSource === 'server', smsOptIn: record.smsOptIn === true,
    noteVersion: Number.isInteger(record.noteVersion) ? Number(record.noteVersion) : 0, marked: record.marked === true };
}
export function arrivalDue(booking: Pick<ServiceReservation, 'date' | 'time'>, timezone: string, now = new Date()) {
  const clock = restaurantClock(timezone, now), minutes = timeMinutes(booking.time);
  return Boolean(booking.date && minutes !== null && (booking.date < clock.date || (booking.date === clock.date && minutes <= clock.minutes)));
}
export function todaySummary(bookings: ServiceReservation[], timezone: string, now = new Date()) {
  const clock = restaurantClock(timezone, now), today = bookings.filter(booking => booking.date === clock.date);
  const expected = today.filter(booking => ['confirmed', 'seated', 'completed'].includes(booking.status));
  const pending = today.filter(booking => booking.status === 'pending');
  const active = today.filter(booking => ['pending', 'confirmed', 'seated'].includes(booking.status));
  return { date: clock.date, total: today.length, expectedCovers: expected.reduce((sum, booking) => sum + booking.guests, 0),
    requestedCovers: pending.reduce((sum, booking) => sum + booking.guests, 0), pending: pending.length,
    upcoming: today.filter(booking => booking.status === 'confirmed' && !arrivalDue(booking, timezone, now)).length,
    seated: today.filter(booking => booking.status === 'seated').length, completed: today.filter(booking => booking.status === 'completed').length,
    cancelled: today.filter(booking => booking.status === 'cancelled').length, noShows: today.filter(booking => booking.status === 'no-show').length,
    specialRequests: active.filter(booking => booking.comments.trim()).length, largeParties: active.filter(booking => booking.guests >= 6).length,
    overdue: today.filter(booking => ['pending', 'confirmed'].includes(booking.status) && arrivalDue(booking, timezone, now)).length };
}
export function todayService(bookings: ServiceReservation[], timezone: string, now = new Date()) {
  const clock = restaurantClock(timezone, now);
  const today = bookings.filter(booking => booking.date === clock.date);
  const sort = (records: ServiceReservation[]) => records.sort((a, b) =>
    (timeMinutes(a.time) ?? 1440) - (timeMinutes(b.time) ?? 1440) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const attention = sort(bookings.filter(booking =>
    (booking.date === clock.date && (booking.status === 'pending' || booking.status === 'needs-review' ||
      (booking.status === 'confirmed' && arrivalDue(booking, timezone, now)))) ||
    (!booking.date && booking.status === 'needs-review')));
  const upcoming = sort(today.filter(booking => booking.status === 'confirmed' && !arrivalDue(booking, timezone, now)));
  return {
    attention,
    arriving: upcoming.filter(booking => timeMinutes(booking.time)! <= clock.minutes + 60),
    later: upcoming.filter(booking => timeMinutes(booking.time)! > clock.minutes + 60),
    seated: sort(today.filter(booking => booking.status === 'seated')),
    finished: sort(today.filter(booking => ['completed', 'cancelled', 'no-show'].includes(booking.status))),
  };
}
const nameKey = (value: string) => value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
const emailKey = (value: string) => value.trim().toLowerCase();
const phoneKey = (value: string) => value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
export function guestKey(booking: Pick<ServiceReservation, 'id' | 'name' | 'email' | 'phone'>) {
  const email = emailKey(booking.email), phone = phoneKey(booking.phone);
  return email || phone ? JSON.stringify([nameKey(booking.name), email, phone]) : `reservation:${booking.id}`;
}
export function guestProfiles(bookings: ServiceReservation[]) {
  const groups = new Map<string, ServiceReservation[]>(), contacts = new Map<string, Set<string>>();
  for (const booking of bookings) {
    const key = guestKey(booking);
    groups.set(key, [...(groups.get(key) || []), booking]);
    for (const contact of [emailKey(booking.email) ? `email:${emailKey(booking.email)}` : '', phoneKey(booking.phone) ? `phone:${phoneKey(booking.phone)}` : ''].filter(Boolean)) {
      if (!contacts.has(contact)) contacts.set(contact, new Set());
      contacts.get(contact)!.add(key);
    }
  }
  return Array.from(groups.entries()).map(([key, history]) => {
    const latest = [...history].sort((a, b) => b.date.localeCompare(a.date))[0];
    const completed = history.filter(booking => booking.status === 'completed');
    const knownParties = completed.filter(booking => booking.guests > 0);
    const preferences = [...history].filter(booking => booking.preferencesUpdatedAt).sort((a, b) => b.preferencesUpdatedAt!.localeCompare(a.preferencesUpdatedAt!))[0];
    return { lastVisit: completed.map(booking => booking.date).filter(Boolean).sort().at(-1) || null,
      averagePartySize: knownParties.length ? knownParties.reduce((sum, booking) => sum + booking.guests, 0) / knownParties.length : null,
      dietaryPreferences: preferences?.dietaryPreferences || '', seatingPreference: preferences?.seatingPreference || '', key, name: latest.name, email: latest.email, phone: latest.phone, bookings: history,
      requests: history.length, completed: history.filter(booking => booking.status === 'completed').length,
      cancelled: history.filter(booking => booking.status === 'cancelled').length, noShows: history.filter(booking => booking.status === 'no-show').length,
      sharedContact: (contacts.get(`email:${emailKey(latest.email)}`)?.size || 0) > 1 || (contacts.get(`phone:${phoneKey(latest.phone)}`)?.size || 0) > 1 };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
