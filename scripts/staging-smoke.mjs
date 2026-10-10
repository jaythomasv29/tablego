import assert from 'node:assert/strict';
import { readFile, readdir, rename, writeFile, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { initializeApp as clientApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth';
import { getFirestore, getDocs, collection, getDocFromServer, doc, updateDoc } from 'firebase/firestore';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore as serverFirestore } from 'firebase-admin/firestore';

const settings = dotenv.parse(await readFile('.env.staging.local'));
const project = 'tablego-staging-1d712';
if (settings.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== project) throw new Error('Smoke tests require staging');
const credentials = JSON.parse(await readFile(settings.GOOGLE_APPLICATION_CREDENTIALS));
if (credentials.project_id !== project) throw new Error('Credentials must belong to staging');
const server = serverFirestore(initializeApp({ projectId: project, credential: cert(credentials) }, `smoke-${randomUUID()}`));
const app = clientApp({ apiKey: settings.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: settings.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: project }, `smoke-${randomUUID()}`);
const auth = getAuth(app), client = getFirestore(app), base = 'http://127.0.0.1:3100';
let staffCookie = '', phoneCookie = '';
const suffix = String(Math.floor(Math.random() * 100)).padStart(2, '0'), phone = `65055501${suffix}`;
const fixtureIds = [];
async function request(path, { method = 'GET', body, cookie, token, key, origin } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: {
    ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(key ? { 'Idempotency-Key': key } : {}), ...(origin ? { Origin: origin } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
function status(result, expected, description) {
  assert.equal(result.status, expected, `${description}: unexpected HTTP status`);
  console.log(`PASS ${description}`);
}
async function permissionDenied(operation, description) {
  let denied = false;
  try { await operation(); } catch (error) { denied = error.code === 'permission-denied'; }
  assert.ok(denied, description); console.log(`PASS ${description}`);
}
function tokenFrom(url) { return new URLSearchParams(new URL(url).hash.slice(1)).get('token'); }
const tomorrow = new Date(Date.now() + 2 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const later = new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
try {
  await permissionDenied(() => getDocs(collection(client, 'reservations')), 'anonymous reservation enumeration denied');
  const login = await request('/api/auth/login', { method: 'POST', body: { username: settings.ADMIN_USERNAME, password: settings.ADMIN_PASSWORD } });
  status(login, 200, 'staff server login'); staffCookie = login.cookie;
  await signInWithCustomToken(auth, login.data.firebaseToken);
  await getDocs(collection(client, 'reservations')); console.log('PASS staff Firebase sign-in and reservation read');
  for (const path of ['/api/check-reservations', '/api/analytics']) status(await request(path, { cookie: 'company-auth=true' }), 401, `forged staff cookie rejected: ${path}`);
  status(await request('/api/auth/logout', { method: 'POST', cookie: staffCookie, origin: 'https://attacker.invalid' }), 403, 'cross-origin staff mutation rejected');
  const availability = await request(`/api/availability/settings?date=${tomorrow}`);
  status(availability, 200, 'staging availability policy');
  assert.ok(availability.data.slots.length, 'Staging fixture needs open hours');
  const formData = { name: 'Synthetic Security Test', email: 'security-test@example.invalid', phone, date: tomorrow, time: availability.data.slots[0].time, guests: 2, comments: '<script>test</script>', status: 'confirmed', admin: true };
  status(await request('/api/send-confirmation', { method: 'POST', key: randomUUID(), body: { formData, phoneVerified: true, smsOptIn: true } }), 403, 'caller-supplied phone verification rejected');
  const sent = await request('/api/otp/send', { method: 'POST', body: { phone } }); status(sent, 200, 'OTP captured in staging');
  const path = `.staging/otp/${createHash('sha256').update(`+1${phone}`).digest('hex')}.json`;
  const challenge = JSON.parse(await readFile(path));
  const verified = await request('/api/otp/verify', { method: 'POST', body: { phone, code: challenge.code } });
  status(verified, 200, 'server phone verification'); assert.equal(verified.data.valid, true); phoneCookie = verified.cookie;
  status(await request('/api/send-confirmation', { method: 'POST', cookie: phoneCookie, key: randomUUID(), body: { formData: { ...formData, guests: 99 } } }), 400, 'invalid booking fields rejected');
  const key = randomUUID();
  const simultaneous = await Promise.all([1, 2].map(() => request('/api/send-confirmation', { method: 'POST', cookie: phoneCookie, key, body: { formData, smsOptIn: true } })));
  for (const result of simultaneous) status(result, 200, 'concurrent booking retry succeeds');
  assert.equal(simultaneous[0].data.reservationId, simultaneous[1].data.reservationId, 'A stable key must create one reservation');
  const created = simultaneous[0].data, id = created.reservationId, token = tokenFrom(created.managementUrl); fixtureIds.push(id);
  const record = (await server.doc(`reservations/${id}`).get()).data();
  assert.equal(record.status, 'pending'); assert.equal(record.phoneVerified, true); assert.equal(record.admin, undefined);
  assert.equal((await server.doc(`reservations/${id}`).collection('events').where('event', '==', 'reservation.created').get()).size, 1);
  console.log('PASS one pending booking per submission key; arbitrary fields excluded');
  await server.doc(`reservations/${id}`).update({ isTest: true });
  status(await request('/api/send-confirmation', { method: 'POST', cookie: phoneCookie, key, body: { formData: { ...formData, guests: 3 }, smsOptIn: true } }), 409, 'idempotency key cannot be reused for different details');
  status(await request(`/api/reservations/${id}`), 403, 'ID-only guest access rejected');
  status(await request(`/api/reservations/${id}`, { token: 'a'.repeat(43) }), 403, 'wrong management token rejected');
  status(await request('/api/reservations/staging-fixture', { token }), 403, 'token cannot manage another reservation');
  await permissionDenied(() => getDocFromServer(doc(client, 'managementAccess', id)), 'staff client cannot read management tokens');
  await permissionDenied(() => getDocFromServer(doc(client, 'staffSessions', 'anything')), 'staff client cannot read server session records');
  await permissionDenied(() => updateDoc(doc(client, 'reservations', id), { status: 'confirmed' }), 'staff client cannot bypass transition APIs');
  const ack = await request(`/api/reservations/${id}`, { method: 'POST', token, body: { action: 'acknowledge' } });
  status(ack, 200, 'guest acknowledgement'); assert.equal(ack.data.reservation.status, 'pending');
  status(await request(`/api/reservations/${id}`, { method: 'POST', token, body: { action: 'confirm' } }), 403, 'guest cannot grant restaurant acceptance');
  status(await request(`/api/staff/reservations/${id}`, { method: 'POST', cookie: staffCookie, body: { action: 'seat' } }), 409, 'pending booking cannot be seated');
  status(await request(`/api/staff/reservations/${id}`, { method: 'POST', cookie: staffCookie, body: { action: 'confirm' } }), 200, 'staff acceptance');
  status(await request('/api/send-sms', { method: 'POST', cookie: staffCookie, body: { reservationId: id, phone: '6505559999' } }), 200, 'SMS reminder uses stored consent and verified recipient');
  const before = (await request(`/api/reservations/${id}`, { token })).data.reservation;
  status(await request(`/api/reservations/${id}`, { method: 'POST', token, body: { action: 'reschedule', date: later, time: '3:00 AM', version: before.version } }), 409, 'unavailable reschedule rejected');
  const unchanged = (await request(`/api/reservations/${id}`, { token })).data.reservation;
  assert.equal(unchanged.date, before.date); assert.equal(unchanged.status, 'confirmed');
  const changed = await request(`/api/reservations/${id}`, { method: 'POST', token, body: { action: 'reschedule', date: later, time: before.time, version: before.version } });
  status(changed, 200, 'valid reschedule saved'); assert.equal(changed.data.reservation.status, 'pending');
  const recovered = await request(`/api/reservations/${id}/recover`, { method: 'POST', cookie: phoneCookie }); status(recovered, 200, 'verified phone restores legacy or expired access');
  status(await request(`/api/reservations/${id}`, { token }), 403, 'recovery rotates and revokes old token');
  const freshToken = tokenFrom(recovered.data.managementUrl);
  status(await request(`/api/reservations/${id}`, { method: 'POST', token: freshToken, body: { action: 'cancel' } }), 200, 'guest cancellation saved');
  const repeated = await request(`/api/reservations/${id}`, { method: 'POST', token: freshToken, body: { action: 'cancel' } });
  status(repeated, 200, 'repeated cancellation safe'); assert.equal(repeated.data.changed, false);
  status(await request(`/api/staff/reservations/${id}`, { method: 'POST', cookie: staffCookie, body: { action: 'confirm' } }), 409, 'cancelled booking cannot be reconfirmed');
  // Disable only this local capture directory to simulate a provider outage.
  const backup = `.staging/outbox-backup-${randomUUID()}`;
  await rename('.staging/outbox', backup); await writeFile('.staging/outbox', 'simulate capture failure', { mode: 0o600 });
  try {
    const outage = await request('/api/send-confirmation', { method: 'POST', cookie: phoneCookie, key: randomUUID(), body: { formData: { ...formData, name: 'Synthetic Delivery Outage' } } });
    status(outage, 200, 'notification outage still returns booking success'); fixtureIds.push(outage.data.reservationId);
    await server.doc(`reservations/${outage.data.reservationId}`).update({ isTest: true });
    const jobs = await server.collection('notificationOutbox').where('reservationId', '==', outage.data.reservationId).get();
    assert.equal(jobs.size, 2); assert.ok(jobs.docs.every(job => job.data().state === 'failed'));
    console.log('PASS notification failures persisted for independent recipients');
    status(await request(`/api/reservations/${outage.data.reservationId}`, { method: 'POST', token: tokenFrom(outage.data.managementUrl), body: { action: 'cancel' } }), 200, 'cancellation survives notification outage');
  } finally { await unlink('.staging/outbox'); await rename(backup, '.staging/outbox'); }
  const hoursRef = server.doc('settings/businessHours'), hours = (await hoursRef.get()).data();
  await hoursRef.delete();
  try {
    const unavailable = await request(`/api/availability/check?date=${tomorrow}&time=7:00%20PM`);
    status(unavailable, 503, 'missing configuration fails closed'); assert.equal(unavailable.data.available, false);
  } finally { await hoursRef.set(hours); }
  for (const file of await readdir('.staging/outbox')) {
    const entry = JSON.parse(await readFile(`.staging/outbox/${file}`));
    if (entry.payload?.subject?.includes('Reservation request received')) assert.ok(!entry.payload.html.includes('<script>'));
  }
  status(await request('/api/auth/logout', { method: 'POST', cookie: staffCookie }), 200, 'staff logout');
  status(await request('/api/check-reservations', { cookie: staffCookie }), 401, 'revoked cookie cannot call staff API');
  await permissionDenied(() => getDocs(collection(client, 'reservations')), 'revoked staff ID token immediately denied by database rules');
  await signOut(auth);
  console.log(`Staging smoke tests passed. ${fixtureIds.length} synthetic reservations retained for review.`);
  process.exit(0);
} catch (error) {
  // Never dump response objects, cookies, credentials, or secure links.
  console.error(`Staging smoke test failed: ${error.message}`);
  process.exit(1);
}
