import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { newManagementToken, encryptToken, tokenHash } from '../src/lib/reservations/managementToken.ts';
const settings = dotenv.parse(await readFile('.env.staging.local'));
const credentials = JSON.parse(await readFile(settings.GOOGLE_APPLICATION_CREDENTIALS));
const project = 'tablego-staging-1d712';
assert.equal(settings.NEXT_PUBLIC_FIREBASE_PROJECT_ID, project); assert.equal(credentials.project_id, project);
process.env.ADMIN_SESSION_SECRET = settings.ADMIN_SESSION_SECRET;
const db = getFirestore(initializeApp({ projectId: project, credential: cert(credentials) }, `sharing-${randomUUID()}`));
const base = process.env.TABLEGO_STAGING_TEST_BASE_URL || 'http://127.0.0.1:3102';
assert.match(base, /^http:\/\/127\.0\.0\.1:310[02]$/);
const records = [], keep = process.argv.includes('--keep-ui');
let uiFixture;
async function fixture(changes = {}) {
  const id = `sharing-${randomUUID()}`, token = newManagementToken();
  const general = (await db.doc('settings/general').get()).data();
  const date = new Date(Date.now() + 4 * 86400000).toLocaleDateString('en-CA', { timeZone: general.timezone });
  const reservation = { name: 'Synthetic Dinner Host', date, time: '7:00 PM', guests: 4, email: 'private-host@example.invalid', phone: '+16505550999',
    comments: 'PRIVATE REQUEST: vegetarian menu', internalNotes: 'PRIVATE STAFF NOTE', status: 'confirmed', restaurantTimezone: general.timezone,
    isTest: true, schemaVersion: 2, version: 1, notificationRevision: 1, noteVersion: 0, createdAt: new Date(), ...changes };
  await db.doc(`reservations/${id}`).create(reservation);
  await db.doc(`managementAccess/${id}`).create({ hash: tokenHash(token), encryptedToken: encryptToken(token), expiresAt: Date.now() + 30 * 86400000 });
  const record = { id, token, reservation }; records.push(record); return record;
}
async function request(record, email, { key = randomUUID(), token = record.token, body, origin, cookie, path = `/api/reservations/${record.id}/share` } = {}) {
  const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key,
    ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(origin ? { Origin: origin } : {}), ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body || { email }) });
  return { status: response.status, data: await response.json() };
}
async function jobs(record) { return (await db.collection('notificationOutbox').where('reservationId', '==', record.id).get()).docs; }
async function waitState(ref, expected) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const data = (await ref.get()).data(); if (data?.state === expected) return data;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Invitation did not reach ${expected}`);
}
try {
  uiFixture = await fixture();
  assert.equal((await request(uiFixture, 'friend@example.invalid', { token: '' })).status, 403);
  assert.equal((await request(uiFixture, 'friend@example.invalid', { token: newManagementToken() })).status, 403);
  assert.equal((await request(uiFixture, 'friend@example.invalid', { origin: 'https://untrusted.example.invalid' })).status, 403);
  assert.equal((await request(uiFixture, 'one@example.invalid,two@example.invalid')).status, 400);
  assert.equal((await request(uiFixture, '', { body: { email: 'friend@example.invalid', name: 'Injected host', guests: 20 } })).status, 400);
  assert.equal((await jobs(uiFixture)).length, 0);
  console.log('PASS sharing requires owner access, rejects cross-origin requests and validates one recipient');

  const key = randomUUID(), initial = await Promise.all(Array.from({ length: 3 }, () => request(uiFixture, 'friend@example.invalid', { key })));
  assert.ok(initial.every(result => result.status === 200));
  const invitations = await jobs(uiFixture); assert.equal(invitations.length, 1);
  const delivery = await waitState(invitations[0].ref, 'delivered'); assert.equal(delivery.deliveryMode, 'capture');
  assert.equal(delivery.attempts, 1); assert.equal(delivery.kind, 'reservation-share');
  assert.deepEqual(Object.keys(delivery.reservation).sort(), ['date', 'guests', 'name', 'restaurantTimezone', 'time']);
  const captureFile = (await readdir('.staging/outbox')).find(file => file.endsWith(`${delivery.providerMessageId}.json`)); assert.ok(captureFile);
  const capture = JSON.parse(await readFile(`.staging/outbox/${captureFile}`));
  assert.equal(capture.payload.to, 'friend@example.invalid'); assert.match(capture.payload.html, /A table to share/);
  for (const privateValue of [uiFixture.token, 'private-host@example.invalid', '+16505550999', 'PRIVATE REQUEST', 'PRIVATE STAFF NOTE', '/reservation/', '#token=']) assert.ok(!JSON.stringify(capture.payload).includes(privateValue), privateValue);
  assert.equal((await db.doc(`reservations/${uiFixture.id}`).get()).data().shareCount, 1);
  assert.equal((await request(uiFixture, 'other@example.invalid', { key })).status, 409);
  assert.equal((await request(uiFixture, 'friend@example.invalid')).status, 429);
  await writeFile('.staging/reservation-invitation-preview.html', capture.payload.html, { mode: 0o600 });
  console.log('PASS concurrent retries produce one captured branded invitation without private requests or owner access');

  await db.doc(`reservations/${uiFixture.id}`).update({ shareCount: 19 });
  const limited = await Promise.all(['limit-a@example.invalid', 'limit-b@example.invalid'].map(email => request(uiFixture, email)));
  assert.deepEqual(limited.map(result => result.status).sort(), [200, 429]);
  assert.equal((await db.doc(`reservations/${uiFixture.id}`).get()).data().shareCount, 20);
  for (const status of ['pending', 'cancelled', 'seated', 'completed']) assert.equal((await request(await fixture({ status }), 'friend@example.invalid')).status, 409);
  assert.equal((await request(await fixture({ date: '2026-01-01' }), 'friend@example.invalid')).status, 409);
  const expired = await fixture(); await db.doc(`managementAccess/${expired.id}`).update({ expiresAt: Date.now() - 1000 });
  assert.equal((await request(expired, 'friend@example.invalid')).status, 403);
  console.log('PASS concurrent send limits, per-recipient cooldown, terminal/pending/past reservations and expired links');

  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: settings.ADMIN_USERNAME, password: settings.ADMIN_PASSWORD }) });
  assert.equal(login.status, 200); const cookie = login.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
  const stale = await fixture(), staleKey = randomUUID(); assert.equal((await request(stale, 'stale@example.invalid', { key: staleKey })).status, 200);
  const oldJob = (await jobs(stale))[0]; await waitState(oldJob.ref, 'delivered');
  await oldJob.ref.update({ state: 'failed', nextAttemptAt: new Date(Date.now() + 3600000), lastError: 'synthetic-retry-test' });
  await db.doc(`reservations/${stale.id}`).update({ status: 'cancelled', notificationRevision: 2 });
  assert.equal((await request(stale, 'stale@example.invalid', { key: staleKey })).status, 409);
  assert.equal((await request(stale, '', { cookie, body: { notificationId: oldJob.id }, path: `/api/staff/reservations/${stale.id}/notifications` })).status, 200);
  await waitState(oldJob.ref, 'superseded');
  await db.doc(`reservations/${stale.id}`).update({ status: 'confirmed', notificationRevision: 3 });
  assert.equal((await request(stale, 'stale@example.invalid', { key: staleKey })).status, 409);
  const saved = (await db.doc(`reservations/${uiFixture.id}`).get()).data();
  assert.equal(saved.status, 'confirmed'); assert.equal(saved.version, 1); assert.equal(saved.guests, 4);
  console.log('PASS queued invitations use stale-update suppression and do not change booking status, version or party size');

  if (keep) {
    await db.doc(`reservations/${uiFixture.id}`).update({ shareCount: 0, shareResetAt: 0, shareRecipients: {} });
    await writeFile('.staging/sharing-ui-booking.json', JSON.stringify({ id: uiFixture.id, managementUrl: `${base}/reservation/${uiFixture.id}#token=${uiFixture.token}`, date: uiFixture.reservation.date, time: uiFixture.reservation.time }, null, 2), { mode: 0o600 });
    console.log('Prepared an isolated synthetic booking for browser review.');
  }
} finally {
  for (const record of records) {
    if (keep && record.id === uiFixture?.id) continue;
    for (const job of await jobs(record)) await job.ref.delete();
    await db.recursiveDelete(db.doc(`managementAccess/${record.id}`));
    await db.recursiveDelete(db.doc(`reservations/${record.id}`));
  }
}
process.exit(0);
