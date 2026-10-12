import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hostingErrors } from '../src/lib/hostingEnvironment.mjs';
import { newReservationIds } from '../src/lib/reservations/alerts.ts';
import { feedbackInput, feedbackSettings, followUpEligibility } from '../src/lib/reservations/feedbackPolicy.ts';
import { renderFeedbackNotification } from '../src/lib/reservations/feedbackRender.ts';
import { encryptToken } from '../src/lib/reservations/managementToken.ts';
import { defaultRestaurant } from '../src/lib/restaurant/config.ts';

test('follow-up eligibility requires a completed real visit, valid email and elapsed completion delay', () => {
  const now = new Date('2026-11-16T01:00:00Z');
  const record = { status: 'completed', email: 'guest@example.invalid', date: '2026-11-15', time: '3:00 PM', completedAt: '2026-11-15T23:00:00Z' };
  assert.equal(followUpEligibility(record, 'America/Los_Angeles', 90, now).eligible, true);
  assert.equal(followUpEligibility({ ...record, time: '7:00 PM' }, 'America/Los_Angeles', 90, now).eligible, false);
  for (const patch of [{ status: 'pending' }, { status: 'no-show' }, { followUpSent: true }, { feedbackSubmissionHash: 'done' }, { email: 'notemail' }, { date: '2026-11-17' }, { completedAt: '2026-11-16T00:45:00Z' }, { completedAt: 'invalid' }]) assert.equal(followUpEligibility({ ...record, ...patch }, 'America/Los_Angeles', 90, now).eligible, false);
  for (const viewerZone of ['UTC', 'Asia/Tokyo', 'Pacific/Auckland']) {
    process.env.TZ = viewerZone;
    assert.equal(followUpEligibility(record, 'America/Los_Angeles', 90, now).eligible, true);
  }
  delete process.env.TZ;
});
test('feedback settings and guest input reject injected attendance, recipients and unsafe URLs', () => {
  assert.deepEqual(feedbackSettings(), { followUpDelayMinutes: 90, reviewUrl: '' });
  for (const reviewUrl of ['javascript:alert(1)', 'https://user:secret@example.invalid', 'http://example.invalid']) assert.throws(() => feedbackSettings({ reviewUrl }));
  for (const followUpDelayMinutes of [-1, 0.5, 10081, '90']) assert.throws(() => feedbackSettings({ followUpDelayMinutes }));
  const feedback = { sentiment: 'did-not-attend', comment: ' Please review my visit. ', stopFollowUps: true };
  assert.equal(feedbackInput(feedback).comment, 'Please review my visit.');
  for (const patch of [{ attendanceStatus: 'no-show' }, { to: 'injected@example.invalid' }, { sentiment: 'fake' }, { comment: '\u0000' }, { comment: 'x'.repeat(2001) }]) assert.throws(() => feedbackInput({ ...feedback, ...patch }));
});
test('new booking alerts ignore first hydration, existing modifications and removed/reconnected bookings', () => {
  const one = { id: 'one', status: 'confirmed' };
  assert.deepEqual(newReservationIds(null, [one]), []);
  const seen = new Set(['one', 'deleted']);
  assert.deepEqual(newReservationIds(seen, [{ ...one, status: 'pending' }, { id: 'deleted', status: 'confirmed' }]), []);
  assert.deepEqual(newReservationIds(seen, [one, { id: 'two', status: 'pending' }, { id: 'old', status: 'completed' }]), ['two']);
});
test('hosted previews reject inherited live credentials and provider test exceptions', () => {
  const env = { VERCEL_ENV: 'preview', TABLEGO_ENVIRONMENT: 'staging', NEXT_PUBLIC_TABLEGO_ENVIRONMENT: 'staging', TABLEGO_NOTIFICATION_MODE: 'capture',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'tablego-staging-1d712', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'tablego-staging-1d712', client_email: 'synthetic', private_key: 'synthetic' }),
    ADMIN_USERNAME: 'synthetic', ADMIN_PASSWORD: 'a-strong-test-password', ADMIN_SESSION_SECRET: 's'.repeat(40), CRON_SECRET: 'c'.repeat(40),
    NEXT_PUBLIC_BASE_URL: 'https://preview.example.invalid', NEXT_PUBLIC_FIREBASE_API_KEY: 'synthetic', NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'synthetic', NEXT_PUBLIC_FIREBASE_APP_ID: 'synthetic' };
  assert.deepEqual(hostingErrors(env), []);
  for (const patch of [{ TABLEGO_ENVIRONMENT: '' }, { NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'tablego-1d712' }, { TABLEGO_NOTIFICATION_MODE: 'provider-test' }, { ADMIN_PASSWORD: '000' }, { NEXT_PUBLIC_BASE_URL: 'http://example.invalid' }, { FIREBASE_SERVICE_ACCOUNT_JSON: '{}' }]) assert.ok(hostingErrors({ ...env, ...patch }).length);
  assert.deepEqual(hostingErrors({}), []);
  assert.ok(hostingErrors({ ...env, VERCEL_ENV: 'production' }).length);
});
test('follow-up and staff feedback emails escape text and provide scoped feedback access only', () => {
  process.env.ADMIN_SESSION_SECRET = 'synthetic-secret'.repeat(4);
  process.env.NEXT_PUBLIC_BASE_URL = 'https://example.invalid';
  process.env.EMAIL_USER = 'restaurant@example.invalid';
  const token = 'a'.repeat(43), reservation = { name: '<script>bad</script>', email: 'guest@example.invalid', date: '2026-11-15', time: '7:00 PM', restaurantTimezone: 'America/Los_Angeles' };
  const guest = renderFeedbackNotification({ kind: 'follow-up', reservationId: 'visit', encryptedToken: encryptToken(token), reservation }, defaultRestaurant);
  assert.match(guest.html, /&lt;script&gt;/); assert.match(guest.html, /\/feedback\/visit#token=/); assert.doesNotMatch(guest.html, /\/reservation\/visit/); assert.match(guest.html, /viewport/);
  const staff = renderFeedbackNotification({ kind: 'feedback-received', reservationId: 'visit', reservation, feedback: { sentiment: 'bad', comment: '<img onerror=alert(1)>' } }, defaultRestaurant);
  assert.equal(staff.to, 'restaurant@example.invalid'); assert.match(staff.html, /&lt;img/); assert.doesNotMatch(staff.html, /<img/);
});
