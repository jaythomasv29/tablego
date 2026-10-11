import { bookingState } from './domain.ts';
import { restaurantClock, timeMinutes, displayTime } from './availability.ts';
import { getLocalDateString } from '../../utils/dateUtils.ts';

export interface InvitationDetails {
  name: string; date: string; time: string; guests: number; restaurantTimezone: string;
}
export const invitationLimit = 20;
export const invitationWindow = 24 * 60 * 60 * 1000;
export const invitationCooldown = 15 * 60 * 1000;

export function invitationEmail(input: unknown): string {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
    Object.keys(input).some(key => key !== 'email')) throw new Error('Enter one recipient email address');
  const value = (input as Record<string, unknown>).email;
  if (typeof value !== 'string' || value.length > 254 || /[\r\n]/.test(value)) throw new Error('Enter a valid email address');
  const email = value.trim().toLowerCase();
  if (!/^[^\s@<>,;:"\\]+@[^\s@<>,;:"\\]+\.[^\s@<>,;:"\\]+$/.test(email)) throw new Error('Enter a valid email address');
  return email;
}

// Invitations deliberately contain only the details someone joining needs.
export function invitationDetails(record: Record<string, unknown>, timezone: string, now = new Date()): InvitationDetails {
  if (bookingState(record) !== 'confirmed') throw new Error('Only confirmed reservations can be shared');
  const date = getLocalDateString(record.date, timezone), minutes = timeMinutes(record.time);
  if (date < restaurantClock(timezone, now).date) throw new Error('This reservation date has passed');
  if (minutes === null || !Number.isInteger(record.guests) || Number(record.guests) < 1 || Number(record.guests) > 20 ||
    typeof record.name !== 'string' || !record.name.trim() || record.name.length > 120) throw new Error('Reservation details need staff review before sharing');
  return { name: record.name, date, time: displayTime(minutes), guests: Number(record.guests), restaurantTimezone: timezone };
}

export function invitationQuota(record: Record<string, unknown>, recipientHash: string, now: number) {
  const reset = typeof record.shareResetAt !== 'number' || record.shareResetAt <= now;
  const count = !reset && typeof record.shareCount === 'number' ? record.shareCount : 0;
  const recent = !reset && record.shareRecipients && typeof record.shareRecipients === 'object'
    ? record.shareRecipients as Record<string, number> : {};
  if (count >= invitationLimit) throw new Error('This reservation has reached its invitation limit. Try again in 24 hours.');
  if (typeof recent[recipientHash] === 'number' && recent[recipientHash] > now - invitationCooldown) throw new Error('An invitation was already queued for this email. Wait 15 minutes before sending again.');
  return { shareCount: count + 1, shareResetAt: reset ? now + invitationWindow : record.shareResetAt as number,
    shareRecipients: { ...recent, [recipientHash]: now } };
}
