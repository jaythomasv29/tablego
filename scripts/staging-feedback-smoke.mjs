import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { tokenHash, encryptToken, decryptToken, newManagementToken } from '../src/lib/reservations/managementToken.ts';
const settings = dotenv.parse(await readFile('.env.staging.local'));
const credentials = JSON.parse(await readFile(settings.GOOGLE_APPLICATION_CREDENTIALS));
assert.equal(settings.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 'tablego-staging-1d712'); assert.equal(credentials.project_id, 'tablego-staging-1d712');
process.env.ADMIN_SESSION_SECRET = settings.ADMIN_SESSION_SECRET;
const db = getFirestore(initializeApp({ projectId: credentials.project_id, credential: cert(credentials) }, 'feedback-' + randomUUID()));
const base = 'http://127.0.0.1:3105', fixtures = [], keep = process.argv.includes('--keep-ui');
let cookie;
async function fixture(changes = {}) {
  const id = 'feedback-audit-' + randomUUID(), owner = newManagementToken(), email = 'audit-' + id + '@example.invalid';
  await db.doc('reservations/' + id).create({ name: 'Synthetic Feedback Guest', email, phone: '+16505550461', date: '2026-10-01', time: '7:00 PM', guests: 2,
    status: 'completed', attendanceStatus: 'show', completedAt: new Date('2026-10-02T05:00:00Z'), version: 3, notificationRevision: 3, isTest: true, createdAt: new Date(), ...changes });
  await db.doc('managementAccess/' + id).create({ hash: tokenHash(owner), encryptedToken: encryptToken(owner), expiresAt: Date.now() + 86400000 });
  const record = { id, owner, email }; fixtures.push(record); return record;
}
async function request(path, { method = 'POST', body, staff = false, token, origin } = {}) {
  const response = await fetch(base + path, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', ...(staff ? { cookie } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(origin ? { Origin: origin } : {}) }, ...(method === 'POST' ? { body: JSON.stringify(body || {}) } : {}) });
  return { status: response.status, headers: response.headers, data: response.status === 303 ? {} : await response.json() };
}
async function wait(ref, state) {
  for (let count = 0; count < 100; count++) { const data = (await ref.get()).data(); if (data?.state === state) return data; await new Promise(resolve => setTimeout(resolve, 100)); }
  throw new Error('Notification did not reach ' + state);
}
async function queue(record) { return request('/api/send-followup', { staff: true, body: { reservationIds: [record.id] } }); }
try {
  const login = await request('/api/auth/login', { body: { username: settings.ADMIN_USERNAME, password: settings.ADMIN_PASSWORD } });
  assert.equal(login.status, 200); cookie = login.headers.get('set-cookie').split(';')[0];
  const completed = await fixture();
  assert.equal((await request('/api/send-followup', { body: { reservationIds: [completed.id] } })).status, 401);
  assert.equal((await request('/api/send-followup', { staff: true, origin: 'https://untrusted.example.invalid', body: { reservationIds: [completed.id] } })).status, 403);
  for (const changes of [{ status: 'pending' }, { status: 'no-show' }, { followUpSent: true }, { feedbackRespondedAt: new Date() }, { completedAt: new Date() }]) {
    const invalid = await fixture(changes); assert.equal((await queue(invalid)).data.results[0].success, false);
  }
  const legacy = await request('/api/feedback/' + completed.id + '?s=noshow', { method: 'GET' });
  assert.equal(legacy.status, 303); assert.equal((await db.doc('reservations/' + completed.id).get()).data().attendanceStatus, 'show');
  assert.equal((await request('/api/send-feedback-notification', { body: { email: 'injected@example.invalid' } })).status, 410);
  console.log('PASS staff/origin authorization, completed-visit delay, preserved legacy replies, and GET cannot mutate attendance');

  const concurrent = await Promise.all([queue(completed), queue(completed), queue(completed)]);
  assert.ok(concurrent.every(result => result.data.results[0].success));
  const jobs = await db.collection('notificationOutbox').where('reservationId', '==', completed.id).get(); assert.equal(jobs.size, 1);
  const delivered = await wait(jobs.docs[0].ref, 'delivered'); assert.equal(delivered.deliveryMode, 'capture');
  assert.equal((await db.doc('reservations/' + completed.id).get()).data().followUpSent, true);
  const access = (await db.doc('managementAccess/' + completed.id + '/feedback/access').get()).data(), token = decryptToken(access.encryptedToken);
  assert.equal((await request('/api/feedback/' + completed.id, { method: 'GET', token: completed.owner })).status, 403);
  assert.equal((await request('/api/reservations/' + completed.id, { method: 'GET', token })).status, 403);
  const view = await request('/api/feedback/' + completed.id, { method: 'GET', token }); assert.equal(view.status, 200); assert.equal(view.data.email, undefined); assert.equal(view.data.phone, undefined);
  console.log('PASS concurrent follow-up queues one captured message and feedback tokens cannot manage reservations');

  assert.equal((await request('/api/feedback/' + completed.id, { token, body: { sentiment: 'bad', comment: '', attendanceStatus: 'no-show' } })).status, 400);
  const body = { sentiment: 'did-not-attend', comment: '<img onerror=alert(1)> Please review.', stopFollowUps: true };
  const posts = await Promise.all(Array.from({ length: 3 }, () => request('/api/feedback/' + completed.id, { token, body }))); assert.ok(posts.every(result => result.status === 200));
  assert.equal((await request('/api/feedback/' + completed.id, { token, body: { ...body, comment: 'changed' } })).status, 409);
  const saved = (await db.doc('reservations/' + completed.id).get()).data();
  assert.equal(saved.status, 'completed'); assert.equal(saved.attendanceStatus, 'show'); assert.equal(saved.version, 3); assert.equal(saved.notificationRevision, 3);
  const afterJobs = await db.collection('notificationOutbox').where('reservationId', '==', completed.id).get(); assert.equal(afterJobs.size, 2);
  const notification = afterJobs.docs.find(doc => doc.data().kind === 'feedback-received'); assert.equal((await wait(notification.ref, 'delivered')).deliveryMode, 'capture');
  const secondVisit = await fixture({ email: completed.email }); assert.equal((await queue(secondVisit)).data.results[0].success, false);
  console.log('PASS feedback idempotency, escaped staff notification, unchanged lifecycle and opt-out on a later visit');
  const tokenBefore = token;
  const phoneSend = await request('/api/otp/send', { body: { phone: '+16505550461' } }); assert.equal(phoneSend.status, 200);
  const otpHash = createHash('sha256').update('+16505550461').digest('hex');
  const challenge = JSON.parse(await readFile('.staging/otp/' + otpHash + '.json'));
  const proof = await request('/api/otp/verify', { body: { phone: '+16505550461', code: challenge.code } }); assert.equal(proof.status, 200);
  const recovery = await fetch(base + '/api/feedback/' + completed.id + '/recover', { method: 'POST', headers: { cookie: proof.headers.get('set-cookie').split(';')[0] } }); assert.equal(recovery.status, 200);
  assert.equal((await request('/api/feedback/' + completed.id, { method: 'GET', token: tokenBefore })).status, 403);
  console.log('PASS server-verified phone recovery rotates feedback access without granting booking management');
  if (keep) {
    const ui = await fixture(); await queue(ui);
    const uiAccess = (await db.doc('managementAccess/' + ui.id + '/feedback/access').get()).data();
    const uiJobs = await db.collection('notificationOutbox').where('reservationId', '==', ui.id).get(), uiDelivery = await wait(uiJobs.docs[0].ref, 'delivered');
    const captureFile = (await readdir('.staging/outbox')).find(file => file.endsWith(uiDelivery.providerMessageId + '.json'));
    await writeFile('.staging/feedback-email-preview.html', JSON.parse(await readFile('.staging/outbox/' + captureFile)).payload.html, { mode: 0o600 });
    await writeFile('.staging/feedback-ui.json', JSON.stringify({ id: ui.id, url: base + '/feedback/' + ui.id + '#token=' + decryptToken(uiAccess.encryptedToken) }), { mode: 0o600 });
    ui.keep = true;
  }
} finally {
  for (const record of fixtures) {
    if (record.keep) continue;
    const jobs = await db.collection('notificationOutbox').where('reservationId', '==', record.id).get(); for (const doc of jobs.docs) await doc.ref.delete();
    await db.recursiveDelete(db.doc('managementAccess/' + record.id)); await db.recursiveDelete(db.doc('reservations/' + record.id));
    await db.doc('managementAccess/_feedback_preferences/preferences/' + createHash('sha256').update(record.email).digest('hex')).delete();
  }
  if (cookie) await fetch(base + '/api/auth/logout', { method: 'POST', headers: { cookie } });
}
process.exit(0);
