import assert from 'node:assert/strict';
import { test } from 'node:test';
import { invitationEmail, invitationDetails, invitationQuota, invitationLimit, invitationCooldown, invitationWindow } from '../src/lib/reservations/sharing.ts';
import { renderReservationInvitation } from '../src/lib/reservations/shareRender.ts';
import { defaultRestaurant } from '../src/lib/restaurant/config.ts';
const zone = 'America/Los_Angeles', now = new Date('2026-10-11T06:30:00Z');
const record = { name: 'Host <script>alert(1)</script>', status: 'confirmed', date: '2026-10-10', time: '11:45 PM', guests: 6,
  email: 'private-host@example.invalid', phone: '+16505550123', comments: 'PRIVATE REQUEST', internalNotes: 'PRIVATE NOTE', encryptedToken: 'PRIVATE TOKEN' };

test('sharing accepts one email address and rejects header injection, multiple recipients and custom content', () => {
  assert.equal(invitationEmail({ email: '  Friend+Dinner@EXAMPLE.INVALID  ' }), 'friend+dinner@example.invalid');
  for (const input of [null, [], 'friend@example.invalid', {}, { email: 1 }, { email: 'friend@example.invalid', text: 'Custom promotion' },
    { email: 'friend@example.invalid\r\nBcc: other@example.invalid' }, { email: 'one@example.invalid,two@example.invalid' },
    { email: 'one@example.invalid;two@example.invalid' }, { email: 'Person <one@example.invalid>' }, { email: 'not-an-email' }]) assert.throws(() => invitationEmail(input));
});

test('invitation snapshots contain only joining details and keep the business date across midnight', () => {
  const details = invitationDetails(record, zone, now);
  assert.deepEqual(details, { name: record.name, date: '2026-10-10', time: '11:45 PM', guests: 6, restaurantTimezone: zone });
  assert.throws(() => invitationDetails(record, zone, new Date('2026-10-11T07:00:00Z')), /date has passed/);
  assert.equal(invitationDetails({ ...record, date: '2026-10-11' }, 'Pacific/Kiritimati', now).date, '2026-10-11');
});

test('only confirmed valid reservations can issue invitations', () => {
  for (const status of ['pending', 'cancelled', 'seated', 'completed', 'no-show', 'needs-review']) assert.throws(() => invitationDetails({ ...record, status }, zone, now), /confirmed/);
  assert.throws(() => invitationDetails({ ...record, attendanceStatus: 'show' }, zone, now), /confirmed/);
  for (const change of [{ date: '2026-02-30' }, { date: undefined }, { time: '25:00' }, { guests: 0 }, { guests: 21 }, { name: '' }]) assert.throws(() => invitationDetails({ ...record, ...change }, zone, now));
});

test('invitation limits enforce a 24-hour window and per-recipient cooldown at their boundaries', () => {
  const timestamp = now.getTime();
  const first = invitationQuota({}, 'recipient-a', timestamp);
  assert.equal(first.shareCount, 1); assert.equal(first.shareResetAt, timestamp + invitationWindow);
  assert.throws(() => invitationQuota(first, 'recipient-a', timestamp + invitationCooldown - 1), /15 minutes/);
  assert.equal(invitationQuota(first, 'recipient-a', timestamp + invitationCooldown).shareCount, 2);
  assert.equal(invitationQuota(first, 'recipient-b', timestamp + 1).shareCount, 2);
  assert.throws(() => invitationQuota({ ...first, shareCount: invitationLimit }, 'recipient-b', timestamp + 1), /invitation limit/);
  const reset = invitationQuota({ ...first, shareCount: invitationLimit }, 'recipient-a', first.shareResetAt);
  assert.equal(reset.shareCount, 1); assert.deepEqual(Object.keys(reset.shareRecipients), ['recipient-a']);
});

test('invitation email is branded, escaped, date-stable and contains no private fields or management access', () => {
  process.env.NEXT_PUBLIC_BASE_URL = 'https://staging.example.invalid';
  const invitation = renderReservationInvitation({ recipientEmail: 'friend@example.invalid', reservation: invitationDetails(record, zone, now) }, defaultRestaurant);
  assert.equal(invitation.to, 'friend@example.invalid'); assert.match(invitation.subject, /Reservation invitation/);
  assert.match(invitation.text, /Saturday, October 10, 2026/); assert.match(invitation.text, /11:45 PM \(America\/Los_Angeles\)/);
  assert.match(invitation.html, /#A3B18A/); assert.match(invitation.html, /A table to share/);
  assert.ok(!invitation.html.includes('<script>')); assert.match(invitation.html, /&lt;script&gt;/);
  const output = JSON.stringify(invitation);
  for (const secret of ['private-host@example.invalid', '+16505550123', 'PRIVATE REQUEST', 'PRIVATE NOTE', 'PRIVATE TOKEN', '#token=', '/reservation/', 'Manage your reservation']) assert.ok(!output.includes(secret), secret);
  assert.ok(!('cc' in invitation)); assert.ok(!('bcc' in invitation));
});
