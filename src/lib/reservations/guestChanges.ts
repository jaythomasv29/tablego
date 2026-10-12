import { validDate, timeMinutes, displayTime } from './availability.ts';

export const cancellationReasons = [
  { code: 'plans-changed', label: 'Plans changed' },
  { code: 'time-doesnt-work', label: 'The time no longer works' },
  { code: 'party-unavailable', label: 'My party can’t attend' },
  { code: 'booked-elsewhere', label: 'Booked somewhere else' },
  { code: 'other', label: 'Other' },
] as const;

export type ReservationChangeInput = { date?: unknown; time?: unknown; guests?: unknown; comments?: unknown; version?: unknown; cancellationReasonCode?: unknown; cancellationReasonDetails?: unknown };
export type ChangeDetails = Record<string, { before: string | number; after: string | number }>;
const invalidControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;

export function reservationEdit(current: { date: string; time: string; guests: unknown; comments?: unknown }, input: ReservationChangeInput = {}) {
  const date = input.date === undefined ? current.date : input.date;
  const minute = timeMinutes(input.time === undefined ? current.time : input.time);
  if (!validDate(date) || minute === null) throw new Error('Enter a valid date and time.');
  const time = displayTime(minute), guests = input.guests === undefined ? current.guests : input.guests;
  if (!Number.isInteger(guests) || Number(guests) < 1 || Number(guests) > 20) throw new Error('Party size must be between 1 and 20.');
  const previousComments = typeof current.comments === 'string' ? current.comments : '';
  const comments = input.comments === undefined ? previousComments : input.comments;
  if (typeof comments !== 'string' || comments.length > 2000 || invalidControls.test(comments)) throw new Error('Special requests must be 2,000 characters or fewer.');
  const details = { date, time, guests: Number(guests), comments: comments.trim() }, changes: ChangeDetails = {};
  const previous = { ...current, time: timeMinutes(current.time) === null ? current.time : displayTime(timeMinutes(current.time)!), comments: previousComments };
  for (const field of ['date', 'time', 'guests', 'comments'] as const) {
    if (previous[field] !== details[field]) changes[field] = { before: typeof previous[field] === 'number' ? previous[field] as number : String(previous[field] ?? ''), after: details[field] };
  }
  return { ...details, changes, changed: Object.keys(changes).length > 0, timingChanged: Boolean(changes.date || changes.time), partyChanged: Boolean(changes.guests) };
}

export function cancellationReasonInput(code: unknown, details: unknown) {
  if (code === undefined || code === '') {
    if (details !== undefined && details !== '') throw new Error('Choose a cancellation reason for your note.');
    return null;
  }
  const selection = cancellationReasons.find(choice => choice.code === code);
  if (!selection) throw new Error('Choose a valid cancellation reason.');
  if (selection.code !== 'other') return { code: selection.code, text: selection.label, details: '' };
  if (typeof details !== 'string' || !details.trim() || details.length > 500 || invalidControls.test(details)) throw new Error('Enter your reason in 500 characters or fewer.');
  return { code: selection.code, text: details.trim(), details: details.trim() };
}

export function reservationChangeHistory(value: unknown) {
  if (!value || typeof value !== 'object') return [];
  const labels = { date: 'Date', time: 'Time', guests: 'Party size', comments: 'Special requests' };
  return Object.entries(labels).flatMap(([field, label]) => {
    const item = (value as Record<string, unknown>)[field];
    if (!item || typeof item !== 'object' || !('before' in item) || !('after' in item)) return [];
    if (!['string', 'number'].includes(typeof item.before) || !['string', 'number'].includes(typeof item.after)) return [];
    return [{ label, before: String(item.before).slice(0, 2000), after: String(item.after).slice(0, 2000) }];
  });
}
