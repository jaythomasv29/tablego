import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { initializeApp, cert, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp as clientApp, deleteApp as deleteClient } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { getFirestore as clientDatabase, doc, updateDoc, terminate } from 'firebase/firestore';
const env = dotenv.parse(await readFile('.env.staging.local'));
const project = 'tablego-staging-1d712';
const credentials = JSON.parse(await readFile(env.GOOGLE_APPLICATION_CREDENTIALS));
if (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== project || credentials.project_id !== project) throw new Error('Staging only');
const adminApp = initializeApp({ projectId: project, credential: cert(credentials) }, randomUUID());
const db = getFirestore(adminApp);
const client = clientApp({ apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY, projectId: project, authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN }, randomUUID());
const auth = getAuth(client), firestore = clientDatabase(client), base = process.env.TABLEGO_STAGING_TEST_BASE_URL || 'http://127.0.0.1:3100';
if (!/^http:\/\/127\.0\.0\.1:310[02]$/.test(base)) throw new Error('Smoke tests require a local capture-staging port');
let cookie, closureId;
const original = (await db.doc('settings/general').get()).data();
async function request(path, method = 'GET', body, headers = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json(), headers: response.headers };
}
function expect(result, code, label) { assert.equal(result.status, code, label); console.log(`PASS ${label}`); }
async function denied(operation, label) { await assert.rejects(operation, error => error.code === 'permission-denied'); console.log(`PASS ${label}`); }
try {
  expect(await request('/api/staff/settings'), 401, 'settings require staff session');
  expect(await request('/api/staff/hours', 'PUT', {}), 401, 'hours require staff session');
  expect(await request('/api/staff/closures', 'POST', {}), 401, 'closures require staff session');
  const login = await request('/api/auth/login', 'POST', { username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD });
  expect(login, 200, 'isolated staff login'); cookie = login.headers.get('set-cookie').split(';')[0];
  await signInWithCustomToken(auth, login.data.firebaseToken);
  const settings = await request('/api/staff/settings'); expect(settings, 200, 'settings allowlisted read');
  assert.match(settings.headers.get('cache-control'), /no-store/);
  expect(await request('/api/staff/settings', 'PUT', { ...settings.data, smtpPassword: 'synthetic' }), 400, 'settings reject secret or unknown fields');
  expect(await request('/api/staff/settings', 'PUT', { ...settings.data, timezone: 'No/Such_Zone' }), 400, 'settings reject invalid timezone');
  expect(await request('/api/staff/settings', 'PUT', settings.data, { Origin: 'https://attacker.invalid' }), 403, 'settings reject foreign mutation origin');
  await db.doc('settings/general').update({ timezone: 'No/Such_Zone' });
  expect(await request('/api/staff/settings'), 503, 'invalid imported settings fail closed without crashing staff UI');
  await db.doc('settings/general').set(original);
  const changed = { ...settings.data, timezone: 'Asia/Tokyo', restaurant: { ...settings.data.restaurant, name: 'Synthetic Staging Restaurant' } };
  expect(await request('/api/staff/settings', 'PUT', changed), 200, 'validated restaurant identity and timezone save');
  expect(await request('/api/staff/settings', 'PUT', settings.data), 409, 'stale settings cannot overwrite another save');
  const policy = await request('/api/availability/settings?date=2026-11-15'); expect(policy, 200, 'public policy after settings save'); assert.equal(policy.data.timezone, 'Asia/Tokyo');
  await denied(() => updateDoc(doc(firestore, 'settings', 'general'), { timezone: 'Europe/London' }), 'client cannot bypass general settings validation');
  await denied(() => updateDoc(doc(firestore, 'settings', 'businessHours'), { invalid: true }), 'client cannot bypass business hours validation');
  const hours = (await db.doc('settings/businessHours').get()).data();
  expect(await request('/api/staff/hours', 'PUT', { ...hours, monday: { ...hours.monday, lunch: { ...hours.monday.lunch, open: '23:00', close: '02:00' } } }), 400, 'invalid hours cannot disable valid booking policy');
  assert.deepEqual((await db.doc('settings/businessHours').get()).data(), hours);
  expect(await request('/api/staff/closures', 'POST', { action: 'save', date: '2026-02-30', reason: 'Synthetic', closureType: 'full' }), 400, 'closure validates actual calendar date');
  const reason = `Synthetic staging closure ${randomUUID()}`;
  expect(await request('/api/staff/closures', 'POST', { action: 'save', date: '2026-11-15', reason, closureType: 'full' }), 200, 'calendar closure saved through staff API');
  const records = await db.collection('specialDates').where('reason', '==', reason).get(); closureId = records.docs[0].id;
  await denied(() => updateDoc(doc(firestore, 'specialDates', closureId), { closureType: 'dinner' }), 'client cannot bypass closure validation');
  assert.equal((await request('/api/availability/settings?date=2026-11-15')).data.slots.length, 0);
  expect(await request('/api/staff/closures', 'POST', { action: 'delete', id: closureId }), 200, 'closure deletion restores booking policy'); closureId = null;
  const inquiry = { name: 'Synthetic Catering Review', email: `synthetic-catering-${randomUUID()}@example.invalid`, phone: '6505550100', date: '2026-11-15', partySize: '20', budget: '$1000', specialRequests: '<script>bad</script>', selectedDishes: [] };
  expect(await request('/api/send-proposal', 'POST', { formData: { ...inquiry, date: 'invalid' } }), 400, 'catering rejects invalid inquiries');
  const inquiryKey = randomUUID();
  const catering = await request('/api/send-proposal', 'POST', { formData: { ...inquiry, status: 'confirmed', privateSecret: 'untrusted' } }, { 'Idempotency-Key': inquiryKey });
  const repeated = await request('/api/send-proposal', 'POST', { formData: inquiry }, { 'Idempotency-Key': inquiryKey });
  expect(repeated, 200, 'catering submission retry succeeds'); assert.equal(repeated.data.cateringId, catering.data.cateringId);
  expect(catering, 200, 'catering returns saved inquiry independently of delivery');
  const record = (await db.doc(`catering/${catering.data.cateringId}`).get()).data(); assert.equal(record.status, 'pending'); assert.equal(record.privateSecret, undefined);
  const deadline = Date.now() + 30000;
  let jobs;
  do { jobs = await db.collection('notificationOutbox').where('entityId', '==', catering.data.cateringId).get(); if (jobs.size === 2 && jobs.docs.every(doc => doc.data().state === 'delivered')) break; await new Promise(resolve => setTimeout(resolve, 200)); } while (Date.now() < deadline);
  assert.equal(jobs.size, 2); assert.ok(jobs.docs.every(doc => doc.data().state === 'delivered'));
  const ids = jobs.docs.map(doc => doc.id); let captures = 0;
  for (const file of await readdir('.staging/outbox')) { const message = JSON.parse(await readFile(`.staging/outbox/${file}`)); if (ids.some(id => message.payload?.messageId?.includes(id))) { captures++; assert.ok(!message.payload.html.includes('<script>')); assert.match(message.payload.subject, /Synthetic Staging Restaurant/); } }
  assert.equal(captures, 2); console.log('PASS catering durable per-recipient jobs use configured identity and escaped content');
} finally {
  if (closureId) await db.doc(`specialDates/${closureId}`).delete();
  if (original) await db.doc('settings/general').set(original);
  if (cookie) await request('/api/auth/logout', 'POST');
  await terminate(firestore); await deleteClient(client); await deleteApp(adminApp);
}
console.log('PASS Phase 5 configuration, privacy, freshness and catering smoke checks');
