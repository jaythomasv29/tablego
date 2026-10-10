import assert from 'node:assert/strict';
import { test } from 'node:test';
import { slotsForDate, checkAvailability, validDate, timeMinutes, restaurantClock } from '../src/lib/reservations/availability.ts';
import { bookingState, transition, isGuestEditable } from '../src/lib/reservations/domain.ts';
import { newManagementToken, tokenHash, encryptToken, decryptToken } from '../src/lib/reservations/managementToken.ts';
const day = { lunch: { open: '11:00', close: '14:30', isOpen: true }, dinner: { open: '17:00', close: '21:30', isOpen: true } };
const policy = { businessHours: Object.fromEntries(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => [d, day])), specialDates: [], timezone: 'America/Los_Angeles', cutoffMinutes: 60, leadTimeMinutes: 50 };
const now = new Date('2026-10-10T17:00:00Z');
test('invalid calendar dates and malformed times cannot become slots', () => {
  for (const date of ['2026-02-29', '2026-13-01', '2026-04-31', '2026-1-01', null]) assert.equal(validDate(date), false);
  assert.equal(validDate('2028-02-29'), true);
  for (const time of ['13:00 PM', '7:60 PM', '25:00', 'bogus', '7', null]) assert.equal(timeMinutes(time), null);
  assert.equal(timeMinutes('7:00pm'), 1140); assert.equal(timeMinutes('19:00'), 1140);
});
test('last seating is inclusive at closing minus cutoff, on future dates too', () => {
  const slots = slotsForDate('2026-10-11', policy, now).map(s => s.time);
  assert.ok(slots.includes('8:30 PM')); assert.ok(!slots.includes('9:00 PM'));
  assert.equal(checkAvailability('2026-10-11', '20:30', policy, now).available, true);
});
test('same-day lead time is inclusive and uses the restaurant clock', () => {
  assert.equal(checkAvailability('2026-10-10', '11:00 AM', policy, new Date('2026-10-10T17:10:00Z')).available, true);
  assert.equal(checkAvailability('2026-10-10', '11:00 AM', policy, new Date('2026-10-10T17:10:01Z')).available, false);
});
test('past dates are unavailable even when the hours are open', () => assert.deepEqual(slotsForDate('2026-10-09', policy, now), []));
test('multiple closures on one calendar date apply together', () => {
  assert.deepEqual(slotsForDate('2026-10-11', { ...policy, specialDates: [{ date: '2026-10-11', closureType: 'lunch' }, { date: '2026-10-11', closureType: 'dinner' }] }, now), []);
});
test('closures retain their year rather than recurring accidentally', () => {
  assert.ok(slotsForDate('2026-10-11', { ...policy, specialDates: [{ date: '2025-10-11' }] }, now).length);
});
test('custom ranges deduplicate overlap and keep alignment to each range opening', () => {
  const hours = { ...day, dinner: { ...day.dinner, customRanges: [{ start: '17:15', end: '20:15' }, { start: '18:15', end: '20:15' }] } };
  const slots = slotsForDate('2026-10-11', { ...policy, businessHours: { ...policy.businessHours, sunday: hours } }, now);
  const dinner = slots.filter(s => s.period === 'dinner').map(s => s.time);
  assert.equal(new Set(dinner).size, dinner.length); assert.ok(dinner.includes('7:15 PM')); assert.ok(!dinner.includes('7:30 PM'));
});
test('missing or invalid configuration cannot report availability', () => {
  for (const changed of [{ businessHours: {} }, { timezone: 'not-a-zone' }, { leadTimeMinutes: -1 }, { cutoffMinutes: '60' }]) assert.throws(() => slotsForDate('2026-10-11', { ...policy, ...changed }, now));
});
test('overnight hours require an explicit policy and fail closed', () => {
  assert.throws(() => slotsForDate('2026-10-11', { ...policy, businessHours: { sunday: { ...day, dinner: { ...day.dinner, open: '22:00', close: '02:00' } } } }, now));
});
test('restaurant clock handles both daylight saving transitions', () => {
  assert.deepEqual(restaurantClock('America/Los_Angeles', new Date('2026-03-08T09:59:00Z')), { date: '2026-03-08', minutes: 119 });
  assert.deepEqual(restaurantClock('America/Los_Angeles', new Date('2026-03-08T10:00:00Z')), { date: '2026-03-08', minutes: 180 });
  assert.deepEqual(restaurantClock('America/Los_Angeles', new Date('2026-11-01T09:00:00Z')), { date: '2026-11-01', minutes: 60 });
});
test('booking lifecycle restricts terminal states and guest editing', () => {
  assert.equal(transition('pending', 'confirm'), 'confirmed'); assert.equal(transition('confirmed', 'seat'), 'seated'); assert.equal(transition('seated', 'complete'), 'completed');
  assert.throws(() => transition('pending', 'seat')); assert.throws(() => transition('cancelled', 'confirm')); assert.throws(() => transition('no-show', 'seat'));
  assert.equal(transition('cancelled', 'cancel'), 'cancelled'); assert.equal(isGuestEditable('completed'), false);
});
test('legacy attendance and cancellation history are preserved; unknown states require review', () => {
  assert.equal(bookingState({ status: 'Cancelled', attendanceStatus: 'show' }), 'cancelled');
  assert.equal(bookingState({ status: 'pending', attendanceStatus: 'show' }), 'seated');
  assert.equal(bookingState({ status: 'confirmed', attendanceStatus: 'no-show' }), 'no-show');
  assert.equal(bookingState({ status: 'unknown-imported-state' }), 'needs-review');
});
test('management links use independent high-entropy tokens and authenticated encryption', t => {
  const saved = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = 'test-secret-with-at-least-32-characters';
  t.after(() => { if (saved === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = saved; });
  const a = newManagementToken(), b = newManagementToken();
  assert.notEqual(a, b); assert.equal(a.length, 43); assert.notEqual(tokenHash(a), a); assert.equal(tokenHash('true'), null);
  const encrypted = encryptToken(a); assert.equal(decryptToken(encrypted), a);
  const bytes = Buffer.from(encrypted, 'base64url'); bytes[15] ^= 1;
  assert.throws(() => decryptToken(bytes.toString('base64url')));
});
