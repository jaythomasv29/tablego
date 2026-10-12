import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serviceReservation, todaySummary, todayService, guestProfiles, arrivalDue } from '../src/lib/reservations/service.ts';
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

test('Today keeps earlier and pending arrivals visible without an attention queue, and excludes other dates', () => {
  const records = [
    booking('later', { status: 'confirmed', time: '8:01 PM' }),
    booking('next', { status: 'confirmed', time: '7:30 PM' }),
    booking('hour-boundary', { status: 'confirmed', time: '8:00 PM' }),
    booking('due', { status: 'confirmed' }),
    booking('pending', { time: '9:00 PM' }),
    booking('seated', { status: 'seated', time: '6:30 PM' }),
    booking('complete', { status: 'completed', time: '6:00 PM' }),
    booking('cancelled', { status: 'cancelled' }),
    booking('no-show', { status: 'no-show' }),
    booking('review', { time: 'invalid' }),
    booking('undated', { date: undefined }),
    booking('tomorrow', { status: 'confirmed', date: '2026-10-11', time: '12:15 AM' }),
    booking('yesterday', { status: 'confirmed', date: '2026-10-09' }),
  ];
  const result = todayService(records, zone, new Date('2026-10-11T02:00:00Z'));
  const ids = rows => rows.map(row => row.id);
  assert.equal('attention' in result, false);
  assert.deepEqual(ids(result.arriving), ['due', 'next', 'hour-boundary']);
  assert.deepEqual(ids(result.later), ['later', 'pending']);
  assert.deepEqual(ids(result.other), ['undated', 'review']);
  assert.deepEqual(ids(result.seated), ['seated']);
  assert.deepEqual(ids(result.finished), ['complete', 'cancelled', 'no-show']);
  assert.equal(Object.values(result).flat().length, 11);
  assert.equal(new Set(Object.values(result).flat().map(row => row.id)).size, 11);
  assert.equal(records[0].id, 'later', 'grouping does not reorder the source records');
});

test('Today retains a booking in arrivals as its time passes without recording an attendance action', () => {
  const records = [booking('next', { status: 'confirmed', time: '7:30 PM' })];
  assert.equal(todayService(records, zone, new Date('2026-10-11T02:29:59Z')).arriving.length, 1);
  assert.equal(todayService(records, zone, new Date('2026-10-11T02:30:00Z')).arriving.length, 1);
  assert.equal(records[0].status, 'confirmed', 'clock grouping must never record a no-show automatically');
});

test('next-hour arrivals remain on the restaurant calendar date across midnight', () => {
  const records = [booking('tonight', { status: 'confirmed', time: '11:45 PM' }),
    booking('tomorrow', { status: 'confirmed', date: '2026-10-11', time: '12:15 AM' })];
  assert.deepEqual(todayService(records, zone, new Date('2026-10-11T06:30:00Z')).arriving.map(row => row.id), ['tonight']);
  assert.deepEqual(todayService(records, zone, new Date('2026-10-11T07:00:00Z')).arriving.map(row => row.id), ['tomorrow']);
});

test('Today groups arrivals using the configured restaurant zone, including the date line', () => {
  const records = [booking('la-today', { status: 'confirmed', time: '9:45 PM' }),
    booking('island-today', { status: 'confirmed', date: '2026-10-11', time: '9:45 PM' })];
  const now = new Date('2026-10-11T07:30:00Z');
  assert.deepEqual(todayService(records, 'Pacific/Honolulu', now).arriving.map(row => row.id), ['la-today']);
  assert.deepEqual(todayService(records, 'Pacific/Kiritimati', now).arriving.map(row => row.id), ['island-today']);
});
