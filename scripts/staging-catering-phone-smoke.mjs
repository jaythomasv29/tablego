import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import dotenv from 'dotenv';
import { initializeApp, cert, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const env = dotenv.parse(await readFile('.env.staging.local'));
const credential = JSON.parse(await readFile(env.GOOGLE_APPLICATION_CREDENTIALS));
assert.equal(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 'tablego-staging-1d712');
assert.equal(credential.project_id, env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
const base = process.env.TABLEGO_STAGING_TEST_BASE_URL || 'http://127.0.0.1:3107';
assert.match(base, /^http:\/\/127\.0\.0\.1:310[0257]$/);
const app = initializeApp({ projectId: credential.project_id, credential: cert(credential) }, randomUUID());
const db = getFirestore(app);
const phone = '+16505550993', run = randomUUID(), key = randomUUID();
const inquiry = { name: 'PHONE VERIFICATION CATERING CHECK', email: `catering-${run}@example.invalid`, phone: '(650) 555-0993', date: '2026-11-15', partySize: '20', budget: '$1000', eventType: 'Corporate', specialRequests: 'Synthetic catering verification test', selectedDishes: [] };
let phoneCookie, cateringId, booking;
async function request(path, body, headers = {}) {
  const response = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json', Origin: base } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json(), headers: response.headers };
}
try {
  const rejected = await request('/api/send-proposal', { formData: { ...inquiry, phoneVerified: true, phoneVerificationSource: 'server' } }, { 'Idempotency-Key': key });
  assert.equal(rejected.status, 403);
  assert.equal((await db.doc(`bookingSubmissions/catering-${key}`).get()).exists, false);
  console.log('PASS unverified catering cannot save a lead or queue notifications');
  assert.equal((await request('/api/otp/send', { phone })).status, 200);
  const challenge = JSON.parse(await readFile(`.staging/otp/${createHash('sha256').update(phone).digest('hex')}.json`));
  const verified = await request('/api/otp/verify', { phone, code: challenge.code });
  assert.equal(verified.status, 200); assert.equal(verified.data.valid, true);
  phoneCookie = verified.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/api/send-proposal', { formData: { ...inquiry, phone: '6505550994' } }, { Cookie: phoneCookie })).status, 403);
  const first = await request('/api/send-proposal', { formData: inquiry }, { Cookie: phoneCookie, 'Idempotency-Key': key });
  assert.equal(first.status, 200); cateringId = first.data.cateringId;
  const retry = await request('/api/send-proposal', { formData: inquiry }, { Cookie: phoneCookie, 'Idempotency-Key': key });
  assert.equal(retry.status, 200); assert.equal(retry.data.cateringId, cateringId);
  const lead = (await db.doc(`catering/${cateringId}`).get()).data();
  assert.equal(lead.phoneVerified, true); assert.equal(lead.phoneVerificationSource, 'server'); assert.equal(lead.phone, phone);
  const deadline = Date.now() + 30000;
  let jobs;
  do {
    jobs = await db.collection('notificationOutbox').where('entityId', '==', cateringId).get();
    if (jobs.size === 2 && jobs.docs.every(doc => doc.data().state === 'delivered')) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  } while (Date.now() < deadline);
  assert.equal(jobs.size, 2); assert.ok(jobs.docs.every(doc => doc.data().state === 'delivered' && doc.data().deliveryMode === 'capture'));
  console.log('PASS verified normalized catering lead, wrong-phone denial, idempotent retry and two captured emails');
  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const availability = await request(`/api/availability/settings?date=${date}`);
  assert.equal(availability.status, 200); assert.ok(availability.data.slots.length);
  const created = await request('/api/send-confirmation', { formData: { name: 'PHONE BADGE PREVIEW CHECK', email: inquiry.email, phone, date, time: availability.data.slots[0].time, guests: 2, comments: 'Synthetic phone badge preview' } }, { Cookie: phoneCookie, 'Idempotency-Key': randomUUID() });
  assert.equal(created.status, 200); booking = created.data;
  assert.equal((await db.doc(`reservations/${booking.reservationId}`).get()).data().phoneVerified, true);
  await writeFile('.staging/catering-phone-smoke-fixtures.json', JSON.stringify({ cateringId, booking }), { mode: 0o600 });
  console.log('PASS phone-verified reservation fixture is available for Today / Reservations UI review');
  console.log('Own fixtures await UI review and cleanup; isolated staging only, no real messages sent.');
} finally {
  if (cateringId || booking) await writeFile('.staging/catering-phone-smoke-fixtures.json', JSON.stringify({ cateringId, booking }), { mode: 0o600 });
  await deleteApp(app);
}
