import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const env = dotenv.parse(await readFile('.env.staging.local'));
const credentials = JSON.parse(await readFile(env.GOOGLE_APPLICATION_CREDENTIALS));
if (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'tablego-staging-1d712' || credentials.project_id !== 'tablego-staging-1d712') throw new Error('Staging only');
const db = getFirestore(initializeApp({ projectId: credentials.project_id, credential: cert(credentials) }, `capture-${randomUUID()}`));
const phone = `65055501${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;
async function request(path, body, cookie, token) {
  const response = await fetch(`http://127.0.0.1:3100${path}`, { method: body ? 'POST' : 'GET', headers: {
    ...(body ? { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() } : {}), ...(cookie ? { cookie } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
try {
  assert.equal((await request('/api/otp/send', { phone })).status, 200);
  const ref = db.doc(`stagingOtpChallenges/${createHash('sha256').update(`+1${phone}`).digest('hex')}`);
  const challenge = (await ref.get()).data(); assert.ok(challenge, 'Start staging with TABLEGO_NOTIFICATION_CAPTURE_STORAGE=firestore');
  const results = await Promise.all([1, 2].map(() => request('/api/otp/verify', { phone, code: challenge.code })));
  assert.equal(results.filter(result => result.data.valid).length, 1, 'Captured challenge is consumed transactionally once');
  const proof = results.find(result => result.data.valid).cookie;
  const date = new Date(Date.now() + 2 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const settings = await request(`/api/availability/settings?date=${date}`); assert.equal(settings.status, 200);
  const created = await request('/api/send-confirmation', { formData: { name: 'Synthetic Hosted Capture', email: 'capture@example.invalid', phone, date, time: settings.data.slots[0].time, guests: 2, comments: '' }, timezone: 'Asia/Tokyo' }, proof);
  assert.equal(created.status, 200);
  const id = created.data.reservationId, token = new URLSearchParams(new URL(created.data.managementUrl).hash.slice(1)).get('token');
  const guest = await request(`/api/reservations/${id}`, undefined, undefined, token);
  assert.equal(guest.data.reservation.date, date); assert.equal(guest.data.reservation.timezone, 'America/Los_Angeles');
  assert.equal((await db.doc(`reservations/${id}`).get()).data().restaurantTimezone, 'America/Los_Angeles');
  const deadline = Date.now() + 30000;
  let jobs;
  while (Date.now() < deadline) {
    jobs = await db.collection('notificationOutbox').where('reservationId', '==', id).get();
    if (jobs.size === 2 && jobs.docs.every(job => job.data().state === 'delivered')) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(jobs.docs.every(job => job.data().state === 'delivered'));
  for (const job of jobs.docs) {
    const captures = await db.collection('stagingCaptures').where('channel', '==', 'email').get();
    assert.equal(captures.docs.filter(capture => capture.data().payload.messageId?.includes(job.id)).length, 1);
  }
  console.log('PASS persistent isolated capture, single-use OTP, independent guest/restaurant email, and authoritative restaurant timezone');
  process.exit(0);
} catch (error) { console.error(`Persistent capture smoke failed: ${error.message}`); process.exit(1); }
