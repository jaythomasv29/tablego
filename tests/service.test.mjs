import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serviceReservation, todaySummary, guestProfiles, arrivalDue } from '../src/lib/reservations/service.ts';
const zone = 'America/Los_Angeles';
const booking = (id, changes = {}) => serviceReservation(id, { name: 'Sam Guest', email: 'sam@example.invalid', phone: '(650) 555-0100', date: '2026-10-10', time: '7:00 PM', guests: 2, status: 'pending', ...changes }, zone);
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
