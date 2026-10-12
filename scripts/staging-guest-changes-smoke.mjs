import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { cert, initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const settings = dotenv.parse(await readFile('.env.staging.local'));
const credentials = JSON.parse(await readFile(settings.GOOGLE_APPLICATION_CREDENTIALS));
assert.equal(settings.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 'tablego-staging-1d712'); assert.equal(credentials.project_id, settings.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
const app = initializeApp({ projectId: credentials.project_id, credential: cert(credentials) }, randomUUID()), db = getFirestore(app);
const base = 'http://127.0.0.1:3107', phone = '+16505550991', fixtures = [];
const original = (await db.doc('settings/general').get()).data();
let staffCookie, phoneCookie;
async function request(path, body, { token, cookie = staffCookie, key } = {}) {
  const response = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json', Origin: base } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
const ok = result => { assert.equal(result.status, 200, result.data.error); return result.data; };
const tokenOf = booking => new URLSearchParams(new URL(booking.managementUrl).hash.slice(1)).get('token');
async function delivered(id, event) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const jobs = await db.collection('notificationOutbox').where('reservationId', '==', id).get();
    const eventJobs = jobs.docs.filter(doc => doc.data().event === event);
    const revision = Math.max(...eventJobs.map(doc => doc.data().notificationRevision));
    const matching = eventJobs.filter(doc => doc.data().notificationRevision === revision);
    if (matching.length === 2 && matching.every(doc => doc.data().state === 'delivered' && doc.data().deliveryMode === 'capture')) return matching;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Captured ${event} notifications did not finish`);
}
async function create(date, time) {
  const booking = ok(await request('/api/send-confirmation', { formData: { name: 'GUEST EDIT PREVIEW CHECK', email: `guest-edit-${randomUUID()}@example.invalid`, phone, date, time, guests: 2, comments: 'Window seat if available' } }, { cookie: phoneCookie, key: randomUUID() }));
  fixtures.push(booking); return booking;
}
try {
  staffCookie = (await request('/api/auth/login', { username: settings.ADMIN_USERNAME, password: settings.ADMIN_PASSWORD })).cookie; assert.ok(staffCookie);
  ok(await request('/api/otp/send', { phone }));
  const challenge = JSON.parse(await readFile(`.staging/otp/${createHash('sha256').update(phone).digest('hex')}.json`));
  const verified = await request('/api/otp/verify', { phone, code: challenge.code }); assert.equal(ok(verified).valid, true); phoneCookie = verified.cookie;
  const days = [];
  for (let offset = 4; offset <= 14 && days.length < 2; offset++) {
    const date = new Date(Date.now() + offset * 86400000).toLocaleDateString('en-CA', { timeZone: original.timezone });
    const slots = ok(await request(`/api/availability/settings?date=${date}`)).slots;
    if (slots.length) days.push({ date, time: slots[0].time });
  }
  assert.equal(days.length, 2);
  await db.doc('settings/general').update({ autoConfirmReservations: true });
  const booking = await create(days[0].date, days[0].time), path = `/api/reservations/${booking.reservationId}`, token = tokenOf(booking);
  const ack = ok(await request(path, { action: 'acknowledge' }, { token })).reservation;
  const requestOnly = ok(await request(path, { action: 'reschedule', comments: 'Vegetarian\nWindow seat', version: ack.version }, { token })).reservation;
  assert.equal(requestOnly.guestAcknowledged, true); assert.equal(requestOnly.date, days[0].date); assert.equal(requestOnly.guests, 2);
  const edited = ok(await request(path, { action: 'reschedule', guests: 4, comments: '', version: requestOnly.version }, { token })).reservation;
  assert.equal(edited.guests, 4); assert.equal(edited.comments, ''); assert.equal(edited.guestAcknowledged, false); assert.equal(edited.status, 'confirmed');
  await delivered(booking.reservationId, 'updated');
  const jobsBefore = (await db.collection('notificationOutbox').where('reservationId', '==', booking.reservationId).get()).size;
  assert.equal(ok(await request(path, { action: 'reschedule', guests: 4, comments: '', version: edited.version }, { token })).changed, false);
  assert.equal((await db.collection('notificationOutbox').where('reservationId', '==', booking.reservationId).get()).size, jobsBefore);
  for (const body of [{ guests: 0 }, { guests: 21 }, { comments: 'x'.repeat(2001) }, { guests: 5, version: 1 }, { ...days[1], time: '3:00 AM', guests: 6 }]) {
    const rejected = await request(path, { action: 'reschedule', ...body }, { token }); assert.ok([400, 409].includes(rejected.status));
    assert.deepEqual(ok(await request(path, undefined, { token })).reservation, edited);
  }
  const moved = ok(await request(path, { action: 'reschedule', ...days[1], guests: 5, comments: 'Celebrating together', version: edited.version }, { token })).reservation;
  assert.equal(moved.date, days[1].date); assert.equal(moved.guests, 5); assert.equal(moved.comments, 'Celebrating together');
  const history = ok(await request(`/api/staff/reservations/${booking.reservationId}/history`));
  assert.ok(history.events.some(event => event.event === 'reservation.updated' && event.changes.some(change => change.label === 'Party size' && change.after === '4')));
  assert.ok(history.events.some(event => event.event === 'reservation.rescheduled' && event.changes.some(change => change.label === 'Party size' && change.after === '5')));
  console.log('PASS partial/full edits, request clearing, same-time preservation, validation, stale version, unavailable slots, idempotency and staff history');
  const manual = await create(days[0].date, days[0].time), manualPath = `/api/reservations/${manual.reservationId}`, manualToken = tokenOf(manual);
  await db.doc('settings/general').update({ autoConfirmReservations: false });
  const pending = ok(await request(manualPath, { action: 'reschedule', guests: 3, version: 1 }, { token: manualToken })).reservation;
  assert.equal(pending.status, 'pending');
  const requests = ok(await request(manualPath, { action: 'reschedule', comments: 'No peanuts', version: pending.version }, { token: manualToken })).reservation;
  assert.equal(requests.status, 'pending');
  for (const reason of [{ cancellationReasonCode: 'other', cancellationReasonDetails: '' }, { cancellationReasonCode: 'invented' }, { cancellationReasonCode: 'other', cancellationReasonDetails: 'x'.repeat(501) }]) assert.equal((await request(manualPath, { action: 'cancel', ...reason }, { token: manualToken })).status, 400);
  assert.equal((await request(manualPath, { action: 'cancel', cancellationReasonCode: 'plans-changed', version: 1 }, { token: manualToken })).status, 409);
  const cancelled = ok(await request(manualPath, { action: 'cancel', cancellationReasonCode: 'plans-changed', version: requests.version }, { token: manualToken })).reservation;
  assert.equal(cancelled.cancellationReason, 'Plans changed');
  const retry = ok(await request(manualPath, { action: 'cancel', cancellationReasonCode: 'other', cancellationReasonDetails: 'Different reason' }, { token: manualToken }));
  assert.equal(retry.changed, false); assert.equal(retry.reservation.cancellationReason, 'Plans changed');
  await delivered(manual.reservationId, 'cancelled');
  await db.doc('settings/general').update({ autoConfirmReservations: true });
  const other = await create(days[0].date, days[0].time), otherPath = `/api/reservations/${other.reservationId}`;
  const otherResult = ok(await request(otherPath, { action: 'cancel', cancellationReasonCode: 'other', cancellationReasonDetails: 'Flight delayed <guest>', version: 1 }, { token: tokenOf(other) }));
  assert.equal(otherResult.reservation.cancellationReason, 'Flight delayed <guest>');
  await delivered(other.reservationId, 'cancelled');
  const cancellationHistory = ok(await request(`/api/staff/reservations/${other.reservationId}/history`));
  assert.ok(cancellationHistory.events.some(event => event.cancellationReason === 'Flight delayed <guest>'));
  const captures = await Promise.all((await readdir('.staging/outbox')).filter(file => file.endsWith('.json')).map(async file => JSON.parse(await readFile(`.staging/outbox/${file}`))));
  assert.ok(captures.some(capture => capture.payload?.headers?.['X-TableGo-Event'] === 'cancelled' && capture.payload.text.includes('Flight delayed <guest>') && capture.payload.html.includes('Flight delayed &lt;guest&gt;')));
  assert.ok(captures.some(capture => capture.payload?.headers?.['X-TableGo-Event'] === 'updated' && capture.payload.text.includes('4 guests')));
  console.log('PASS manual acceptance, cancellation validation/version checks, common/Other reasons, idempotent cancellation, staff timeline and captured emails');
  console.log('One owned future staging booking remains active for mobile UI review; other fixtures cancelled.');
} catch (error) {
  // All fixture IDs remain available for cleanup even when a check fails.
  throw error;
} finally {
  await db.doc('settings/general').set(original);
  await writeFile('.staging/guest-changes-fixtures.json', JSON.stringify({ fixtures }), { mode: 0o600 });
  if (staffCookie) await request('/api/auth/logout', {});
  await deleteApp(app);
}
