import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serviceReservation, todaySummary, todayReservations, reservationTimePassed, guestProfiles, arrivalDue } from '../src/lib/reservations/service.ts';
const zone = 'America/Los_Angeles';
const booking = (id, changes = {}) => serviceReservation(id, { name: 'Sam Guest', email: 'sam@example.invalid', phone: '(650) 555-0100', date: '2026-10-10', time: '7:00 PM', guests: 2, status: 'pending', ...changes }, zone);
test('verified phone status requires a valid number and server provenance in bookings and guest profiles', () => {
  const legacy = booking('legacy', { phoneVerified: true });
  const verified = booking('verified', { phoneVerified: true, phoneVerificationSource: 'server' });
  assert.equal(legacy.phoneVerified, false);
  assert.equal(verified.phoneVerified, true);
  assert.equal(booking('invalid', { phone: '', phoneVerified: true, phoneVerificationSource: 'server' }).phoneVerified, false);
  assert.equal(guestProfiles([legacy])[0].phoneVerified, false);
  assert.equal(guestProfiles([legacy, verified])[0].phoneVerified, true);
});
test('legacy timestamps become business calendar dates while calendar strings stay unchanged', () => {
  assert.equal(booking('a', { date: { toDate: () => new Date('2026-10-11T01:00:00Z') } }).date, '2026-10-10');
  assert.equal(booking('b', { date: '2026-10-11' }).date, '2026-10-11');
  assert.equal(booking('c', { date: undefined }).status, 'needs-review');
  assert.equal(booking('c', { time: '25:00' }).status, 'needs-review');
});
test('Today separates accepted covers, pending requests, completed visits and cancellations', () => {
  const records = [booking('pending'), booking('confirmed', { status: 'confirmed', guests: 6, comments: 'Allergy' }),
    booking('complete', { status: 'completed' }), booking('cancel', { status: 'cancelled', attendanceStatus: 'show' }), booking('legacy-show', { status: 'confirmed', attendanceStatus: 'show' })];
  const result = todaySummary(records, zone, new Date('2026-10-11T01:00:00Z'));
  assert.equal(result.date, '2026-10-10'); assert.equal(result.expectedCovers, 10); assert.equal(result.requestedCovers, 2);
  assert.equal(result.completed, 1); assert.equal(result.cancelled, 1); assert.equal(result.seated, 1); assert.equal(result.largeParties, 1);
  assert.equal(result.specialRequests, 1); assert.equal(result.upcoming, 1);
});
test('no-show eligibility uses business time including both repeated daylight saving hours', () => {
  assert.equal(arrivalDue(booking('future'), zone, new Date('2026-10-11T01:00:00Z')), false);
  assert.equal(arrivalDue(booking('due'), zone, new Date('2026-10-11T02:00:00Z')), true);
  const repeated = booking('repeated', { date: '2026-11-01', time: '1:30 AM' });
  assert.equal(arrivalDue(repeated, zone, new Date('2026-11-01T08:30:00Z')), true);
  assert.equal(arrivalDue(repeated, zone, new Date('2026-11-01T09:30:00Z')), true);
});
test('guest history groups normalized exact identities and flags shared contacts without merging people', () => {
  const records = [booking('a', { status: 'completed' }), booking('b', { name: ' SAM   GUEST ', email: 'SAM@EXAMPLE.INVALID', phone: '+16505550100', status: 'cancelled' }),
    booking('c', { name: 'Another Guest', status: 'no-show' }), booking('d', { email: '', phone: '' }), booking('e', { email: '', phone: '' })];
  const profiles = guestProfiles(records), sam = profiles.find(profile => profile.completed === 1);
  assert.equal(profiles.length, 4); assert.equal(sam.requests, 2); assert.equal(sam.cancelled, 1); assert.equal(sam.noShows, 0); assert.equal(sam.sharedContact, true);
  assert.equal(profiles.reduce((sum, profile) => sum + profile.requests, 0), records.length);
  assert.equal(profiles.reduce((sum, profile) => sum + profile.completed, 0), 1);
});

test('invalid imported dates never erase cancellation history', () => {
  const record = booking('invalid-cancel', { date: '2026-02-30', status: 'cancelled', attendanceStatus: 'show' });
  assert.equal(record.status, 'cancelled'); assert.equal(record.needsReview, true); assert.equal(record.date, '');
});
test('guest last visit and average party include completed service only; preferences remain explicit', () => {
  const profile = guestProfiles([booking('a', { status: 'completed', guests: 2, date: '2026-09-10' }),
    booking('b', { status: 'completed', guests: 4, date: '2026-09-20', dietaryPreferences: 'Guest requests vegetarian options', seatingPreference: 'Window', preferencesUpdatedAt: new Date('2026-09-20T18:00:00Z') }),
    booking('unknown-party', { status: 'completed', guests: undefined, date: '2026-09-11' }),
    booking('c', { status: 'cancelled', guests: 10, date: '2026-10-10', comments: 'Allergy request' })])[0];
  assert.equal(profile.lastVisit, '2026-09-20'); assert.equal(profile.averagePartySize, 3);
  assert.equal(profile.seatingPreference, 'Window'); assert.equal(profile.dietaryPreferences, 'Guest requests vegetarian options');
});

test('service rows show customer acknowledgement only for a valid saved timestamp', () => {
 const record = { name: 'Guest', date: '2026-10-15', time: '7:00 PM', guests: 2, status: 'confirmed' };
 assert.equal(serviceReservation('fixture', record, 'America/Los_Angeles').guestAcknowledged, false);
 assert.equal(serviceReservation('fixture', { ...record, guestAcknowledgedAt: '2026-10-11T07:50:00Z' }, 'America/Los_Angeles').guestAcknowledged, true);
 assert.equal(serviceReservation('fixture', { ...record, guestAcknowledgedAt: 'invalid' }, 'America/Los_Angeles').guestAcknowledged, false);
});

test('Today lists every status in time order, with incomplete schedules last and other dates excluded', () => {
  const records = [
    booking('later', { status: 'confirmed', time: '8:01 PM' }),
    booking('next', { status: 'confirmed', time: '7:30 PM' }),
    booking('due', { status: 'confirmed' }),
    booking('pending', { time: '9:00 PM' }),
    booking('seated', { status: 'seated', time: '6:30 PM' }),
    booking('complete', { status: 'completed', time: '6:00 PM' }),
    booking('cancelled', { status: 'cancelled', time: '7:15 PM' }),
    booking('no-show', { status: 'no-show', time: '7:45 PM' }),
    booking('review', { time: 'invalid' }),
    booking('undated', { date: undefined, time: '5:00 PM' }),
    booking('tomorrow', { status: 'confirmed', date: '2026-10-11', time: '12:15 AM' }),
    booking('yesterday', { status: 'confirmed', date: '2026-10-09' }),
  ];
  const result = todayReservations(records, zone, new Date('2026-10-11T02:00:00Z'));
  assert.deepEqual(result.map(row => row.id), ['complete', 'seated', 'due', 'cancelled', 'next', 'no-show', 'later', 'pending', 'review', 'undated']);
  assert.equal(new Set(result.map(row => row.id)).size, 10);
  assert.equal(records[0].id, 'later', 'the timeline must not reorder source records');
});

test('passed-time cues start after the scheduled second, apply only while awaiting arrival and never change a booking', () => {
  const record = booking('waiting', { status: 'confirmed' });
  const before = structuredClone(record);
  assert.equal(reservationTimePassed(record, zone, new Date('2026-10-11T01:59:59Z')), false);
  assert.equal(reservationTimePassed(record, zone, new Date('2026-10-11T02:00:00Z')), false);
  assert.equal(reservationTimePassed(record, zone, new Date('2026-10-11T02:00:01Z')), true);
  for (const status of ['pending', 'confirmed', 'needs-review']) assert.equal(reservationTimePassed({ ...record, status }, zone, new Date('2026-10-11T03:00:00Z')), true);
  for (const status of ['seated', 'completed', 'cancelled', 'no-show']) assert.equal(reservationTimePassed({ ...record, status }, zone, new Date('2026-10-11T03:00:00Z')), false);
  assert.equal(reservationTimePassed({ ...record, time: 'invalid' }, zone, new Date('2026-10-11T03:00:00Z')), false);
  assert.equal(reservationTimePassed({ ...record, date: '' }, zone, new Date('2026-10-11T03:00:00Z')), false);
  assert.deepEqual(record, before);
});

test('Today rolls over at restaurant midnight, and time cues respect the business calendar', () => {
  const tonight = booking('tonight', { status: 'confirmed', time: '11:45 PM' });
  const tomorrow = booking('tomorrow', { status: 'confirmed', date: '2026-10-11', time: '12:15 AM' });
  assert.deepEqual(todayReservations([tonight, tomorrow], zone, new Date('2026-10-11T06:30:00Z')).map(row => row.id), ['tonight']);
  assert.deepEqual(todayReservations([tonight, tomorrow], zone, new Date('2026-10-11T07:00:00Z')).map(row => row.id), ['tomorrow']);
  assert.equal(reservationTimePassed(tonight, zone, new Date('2026-10-11T06:46:00Z')), true);
  assert.equal(reservationTimePassed(tomorrow, zone, new Date('2026-10-11T06:46:00Z')), false);
});

test('Today uses the configured restaurant date across the international date line', () => {
  const records = [booking('island-yesterday', { status: 'confirmed', time: '9:45 PM' }),
    booking('island-today', { status: 'confirmed', date: '2026-10-11', time: '9:45 PM' })];
  const now = new Date('2026-10-11T08:00:00Z');
  assert.deepEqual(todayReservations(records, 'Pacific/Honolulu', now).map(row => row.id), ['island-yesterday']);
  assert.deepEqual(todayReservations(records, 'Pacific/Kiritimati', now).map(row => row.id), ['island-today']);
  assert.equal(reservationTimePassed(records[0], 'Pacific/Honolulu', now), true);
  assert.equal(reservationTimePassed(records[1], 'Pacific/Kiritimati', now), true);
});

test('passed-time cues compare business wall time through both repeated daylight-saving hours', () => {
  const repeated = booking('repeated', { date: '2026-11-01', time: '1:30 AM', status: 'confirmed' });
  for (const hour of ['08', '09']) {
    assert.equal(reservationTimePassed(repeated, zone, new Date(`2026-11-01T${hour}:29:59Z`)), false);
    assert.equal(reservationTimePassed(repeated, zone, new Date(`2026-11-01T${hour}:30:00Z`)), false);
    assert.equal(reservationTimePassed(repeated, zone, new Date(`2026-11-01T${hour}:30:01Z`)), true);
  }
});
