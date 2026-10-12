import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeActivityReadMarkers, parseActivityReadMarker, readReservationActivity, recentReservationActivity, unreadReservationActivity } from '../src/lib/reservations/activity.ts';

const booking = (id, createdAt, extra = {}) => ({ id, createdAt, name: 'Synthetic guest', status: 'confirmed', date: '2026-11-15', ...extra });
const baseline = booking('old', '2026-10-12T08:00:00Z');

test('the first visit establishes a quiet baseline and reading never changes reservation data', () => {
  const records = [baseline], before = structuredClone(records);
  assert.deepEqual(unreadReservationActivity(records, null), []);
  const marker = readReservationActivity(records, null);
  assert.deepEqual(unreadReservationActivity(records, marker), []);
  assert.deepEqual(records, before);
});

test('new booking notifications survive reload, clear on reading and include any reservation date', () => {
  const marker = readReservationActivity([baseline], null);
  const fresh = booking('fresh', '2026-10-12T08:01:00Z', { date: '2027-01-15' });
  const records = recentReservationActivity([baseline, fresh]);
  assert.deepEqual(unreadReservationActivity(records, parseActivityReadMarker(JSON.stringify(marker))).map(row => row.id), ['fresh']);
  const read = readReservationActivity(records, marker);
  assert.deepEqual(unreadReservationActivity(records, parseActivityReadMarker(JSON.stringify(read))), []);
  const whileOpen = booking('while-open', '2026-10-12T08:02:00Z');
  assert.deepEqual(unreadReservationActivity([...records, whileOpen], readReservationActivity([...records, whileOpen], read)), []);
});

test('status edits, removals and reconnects never turn existing bookings into new activity', () => {
  const read = readReservationActivity([baseline], null);
  for (const status of ['pending', 'cancelled', 'seated', 'completed']) assert.deepEqual(unreadReservationActivity([{ ...baseline, status }], read), []);
  assert.deepEqual(unreadReservationActivity([], read), []);
  assert.deepEqual(unreadReservationActivity([baseline], read), []);
});

test('timestamp ties preserve simultaneous bookings and read markers never move backwards', () => {
  const read = readReservationActivity([baseline], null), simultaneous = booking('a-before-old', baseline.createdAt);
  assert.deepEqual(unreadReservationActivity([baseline, simultaneous], read).map(row => row.id), ['a-before-old']);
  const merged = readReservationActivity([simultaneous], read);
  assert.deepEqual(unreadReservationActivity([baseline, simultaneous], merged), []);
  assert.equal(readReservationActivity([booking('earlier', '2026-10-11T08:00:00Z')], merged), merged);
  assert.deepEqual(mergeActivityReadMarkers(read, merged), merged);
});

test('activity ignores unusable creation times, caps its feed and rejects malformed saved state', () => {
  const records = Array.from({ length: 60 }, (_, i) => booking(String(i), new Date(Date.UTC(2026, 9, 12, 8, i)).toISOString()));
  const recent = recentReservationActivity([...records, booking('legacy', null), booking('broken', 'invalid')]);
  assert.equal(recent.length, 50);
  assert.equal(recent[0].id, '59');
  assert.equal(recent.at(-1).id, '10');
  assert.equal(records[0].id, '0');
  for (const value of [null, '{', '{}', '{"at":-1,"ids":[]}', '{"at":10,"ids":[42]}']) assert.equal(parseActivityReadMarker(value), null);
});
