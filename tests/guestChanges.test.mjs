import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reservationEdit, cancellationReasonInput, cancellationReasons, reservationChangeHistory } from '../src/lib/reservations/guestChanges.ts';
const current = { date: '2026-11-15', time: '7:00 PM', guests: 2, comments: 'Window seat' };
test('details-only edits preserve restaurant date/time and distinguish party changes', () => {
  const edit = reservationEdit(current, { guests: 4, comments: '  Vegetarian\nWindow seat  ' });
  assert.equal(edit.date, current.date); assert.equal(edit.time, current.time); assert.equal(edit.timingChanged, false); assert.equal(edit.partyChanged, true);
  assert.deepEqual(edit.changes, { guests: { before: 2, after: 4 }, comments: { before: 'Window seat', after: 'Vegetarian\nWindow seat' } });
  assert.equal(reservationEdit(current, { comments: '' }).comments, '');
  assert.equal(reservationEdit(current, {}).changed, false);
  assert.equal(reservationEdit(current, { date: '2026-11-16', time: '18:30' }).guests, 2);
  assert.equal(reservationEdit(current, { date: '2026-11-16', time: '18:30' }).comments, current.comments);
});
test('guest edits reject invalid party sizes, malformed dates and unsafe or oversized requests', () => {
  for (const guests of [0, 21, 1.5, '4', null]) assert.throws(() => reservationEdit(current, { guests }));
  for (const comments of [null, 'x'.repeat(2001), 'bad\u0000value']) assert.throws(() => reservationEdit(current, { comments }));
  assert.throws(() => reservationEdit(current, { date: '2026-02-30' }));
  assert.throws(() => reservationEdit(current, { time: 'tomorrow' }));
});
test('cancellation supports four common reasons, optional selection and a bounded Other note', () => {
  assert.equal(cancellationReasons.length, 5);
  for (const reason of cancellationReasons.slice(0, 4)) assert.equal(cancellationReasonInput(reason.code, '').text, reason.label);
  assert.equal(cancellationReasonInput(undefined, undefined), null);
  assert.equal(cancellationReasonInput('', ''), null);
  assert.equal(cancellationReasonInput('other', '  Flight delayed\nArriving tomorrow  ').text, 'Flight delayed\nArriving tomorrow');
  for (const note of ['', '   ', 'x'.repeat(501), 'bad\u0000value', null]) assert.throws(() => cancellationReasonInput('other', note));
  assert.throws(() => cancellationReasonInput('invented', ''));
  assert.throws(() => cancellationReasonInput('', 'note'));
});
test('staff change history exposes only bounded, known reservation details', () => {
  assert.deepEqual(reservationChangeHistory({ guests: { before: 2, after: 4 }, comments: { before: 'Window', after: '' }, secret: { before: 'private', after: 'secret' }, date: { before: {}, after: [] } }), [
    { label: 'Party size', before: '2', after: '4' }, { label: 'Special requests', before: 'Window', after: '' },
  ]);
  assert.deepEqual(reservationChangeHistory(null), []);
});
