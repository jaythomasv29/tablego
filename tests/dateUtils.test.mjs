import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getLocalDateString,
  convertDateToStorageFormat,
  formatReadableDatePST,
  getDayOfWeekInTimezone,
  formatTimeInTimezone,
  formatDateForDisplay,
  getDateInTimezone,
} from '../src/utils/dateUtils.ts';

test('date-only reservations retain their calendar date in every supported timezone', () => {
  for (const zone of ['America/Los_Angeles', 'Pacific/Honolulu', 'Asia/Tokyo']) {
    assert.equal(getLocalDateString('2026-10-10', zone), '2026-10-10');
    assert.equal(convertDateToStorageFormat('2026-10-10', zone), '2026-10-10');
  }
});

for (const [instant, expected] of [
  ['2026-01-02T07:59:00Z', '2026-01-01'],
  ['2026-01-02T08:00:00Z', '2026-01-02'],
  ['2026-07-02T06:59:00Z', '2026-07-01'],
  ['2026-07-02T07:00:00Z', '2026-07-02'],
]) {
  test(`restaurant calendar date across midnight: ${instant}`, () => {
    assert.equal(getLocalDateString(instant), expected);
    assert.equal(convertDateToStorageFormat(new Date(instant)), expected);
  });
}

test('Firestore timestamp dates convert using restaurant timezone', () => {
  const timestamp = { toDate: () => new Date('2026-01-02T07:59:00Z') };
  assert.equal(getLocalDateString(timestamp), '2026-01-01');
});

test('spring daylight saving jump skips the missing hour', () => {
  assert.equal(formatTimeInTimezone(new Date('2026-03-08T09:30:00Z')), '1:30 AM');
  assert.equal(formatTimeInTimezone(new Date('2026-03-08T10:30:00Z')), '3:30 AM');
});

test('fall daylight saving transition repeats the local hour', () => {
  assert.equal(formatTimeInTimezone(new Date('2026-11-01T08:30:00Z')), '1:30 AM');
  assert.equal(formatTimeInTimezone(new Date('2026-11-01T09:30:00Z')), '1:30 AM');
});

test('weekday is evaluated in restaurant timezone near UTC midnight', () => {
  assert.equal(getDayOfWeekInTimezone(new Date('2026-10-11T01:00:00Z')), 'saturday');
});

test('date-only email formatting is stable across guest timezones', () => {
  for (const zone of ['America/Los_Angeles', 'Pacific/Honolulu', 'Asia/Tokyo']) {
    assert.equal(formatReadableDatePST('2026-02-16', zone), 'Monday, February 16, 2026');
  }
});

test('impossible calendar dates are rejected', () => {
  for (const value of ['2026-02-30', '2026-13-01', '2026-00-01', 'not-a-date']) {
    assert.throws(() => getLocalDateString(value), RangeError);
    assert.throws(() => formatDateForDisplay(value), RangeError);
  }
});
test('missing dates never default to today', () => {
  for (const value of [undefined, null, '', {}]) assert.throws(() => getLocalDateString(value), RangeError);
});
test('display of calendar dates is stable even across the date line', () => {
  for (const zone of ['Pacific/Kiritimati', 'Pacific/Honolulu', 'America/Los_Angeles'])
    assert.equal(formatDateForDisplay('2026-10-10', zone), 'October 10, 2026');
  assert.equal(formatReadableDatePST('2026-01-02T07:59:00Z'), 'Thursday, January 1, 2026');
});
test('restaurant clock uses zero rather than 24 at midnight', () => {
  assert.equal(getDateInTimezone(new Date('2026-01-02T08:00:00Z')).getHours(), 0);
});
