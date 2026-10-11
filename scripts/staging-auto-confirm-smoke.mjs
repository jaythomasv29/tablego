import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
const settings = dotenv.parse(await readFile('.env.staging.local'));
const project = 'tablego-staging-1d712';
const credentials = JSON.parse(await readFile(settings.GOOGLE_APPLICATION_CREDENTIALS));
assert.equal(settings.NEXT_PUBLIC_FIREBASE_PROJECT_ID, project); assert.equal(credentials.project_id, project);
const db = getFirestore(initializeApp({ projectId: project, credential: cert(credentials) }, `auto-${randomUUID()}`));
const base = process.env.TABLEGO_STAGING_TEST_BASE_URL || 'http://127.0.0.1:3102';
assert.match(base, /^http:\/\/127\.0\.0\.1:310[02]$/);
let staffCookie, phoneCookie;
const fixtures = [], generalRef = db.doc('settings/general'), original = (await generalRef.get()).data();
async function request(path, body, { cookie, token, key } = {}) {
 const response = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
 const data = await response.json(); return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
function ok(result) { assert.equal(result.status, 200, result.data.error); return result.data; }
const tokenOf = booking => new URLSearchParams(new URL(booking.managementUrl).hash.slice(1)).get('token');
async function saveMode(value, omit = false) {
 const current = ok(await request('/api/staff/settings', undefined, { cookie: staffCookie }));
 const body = { ...current, autoConfirmReservations: value }; if (omit) delete body.autoConfirmReservations;
 const response = await fetch(`${base}/api/staff/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json', cookie: staffCookie }, body: JSON.stringify(body) });
 assert.equal(response.status, 200); assert.equal((await generalRef.get()).data().autoConfirmReservations, value);
}
async function waitJobs(id) {
 for (let i=0;i<150;i++) {
  const jobs = await db.collection('notificationOutbox').where('reservationId','==',id).get();
  if (jobs.size && jobs.docs.every(job => job.data().state === 'delivered')) return jobs.docs;
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 throw new Error('Captured notifications did not finish');
}
try {
 staffCookie = (await request('/api/auth/login', { username: settings.ADMIN_USERNAME, password: settings.ADMIN_PASSWORD })).cookie; assert.ok(staffCookie);
 const phone = `65055502${String(Math.floor(Math.random()*100)).padStart(2,'0')}`;
 ok(await request('/api/otp/send', { phone }));
 const challenge = JSON.parse(await readFile(`.staging/otp/${createHash('sha256').update(`+1${phone}`).digest('hex')}.json`));
 const verification = await request('/api/otp/verify', { phone, code: challenge.code }); assert.equal(ok(verification).valid,true); phoneCookie = verification.cookie;
 await generalRef.update({ autoConfirmReservations: FieldValue.delete() });
 const date = new Date(Date.now()+4*86400000).toLocaleDateString('en-CA',{timeZone:original.timezone});
 const later = new Date(Date.now()+5*86400000).toLocaleDateString('en-CA',{timeZone:original.timezone});
 const slots = ok(await request(`/api/availability/settings?date=${date}`)).slots; assert.ok(slots.length);
 const formData = { name:'Synthetic Auto Confirmation',email:'auto-confirm@example.invalid',phone,date,time:slots[0].time,guests:2,comments:'' };
 const key = randomUUID(), create = () => request('/api/send-confirmation',{formData,smsOptIn:true},{cookie:phoneCookie,key});
 const results = await Promise.all([create(),create()]); const booking=ok(results[0]); assert.equal(ok(results[1]).reservationId,booking.reservationId); fixtures.push(booking.reservationId);
 assert.equal(booking.reservationDetails.status,'confirmed');
 const record=(await db.doc(`reservations/${booking.reservationId}`).get()).data(); assert.equal(record.confirmedBy,'automatic'); assert.equal(record.date,date);
 const jobs=await waitJobs(booking.reservationId); assert.equal(jobs.length,2); assert.ok(jobs.every(job=>job.data().event==='created' && job.data().deliveryMode==='capture'));
 assert.equal((await db.collection(`reservations/${booking.reservationId}/events`).where('event','==','reservation.auto_confirmed').get()).size,1);
 console.log('PASS missing setting defaults to automatic confirmation; concurrent submissions produce one booking and one email per recipient');
 const token=tokenOf(booking), path=`/api/reservations/${booking.reservationId}`;
 const ack=ok(await request(path,{action:'acknowledge'},{token})); assert.equal(ack.reservation.status,'confirmed'); assert.equal(ack.reservation.guestAcknowledged,true);
 const invalid=await request(path,{action:'reschedule',date:later,time:'3:00 AM',version:ack.reservation.version},{token}); assert.equal(invalid.status,409);
 const unchanged=ok(await request(path,undefined,{token})).reservation; assert.equal(unchanged.date,date); assert.equal(unchanged.guestAcknowledged,true);
 const newSlots=ok(await request(`/api/availability/settings?date=${later}`)).slots;
 const moved=ok(await request(path,{action:'reschedule',date:later,time:newSlots[0].time,version:unchanged.version},{token})); assert.equal(moved.reservation.status,'confirmed'); assert.equal(moved.reservation.guestAcknowledged,false);
 console.log('PASS guest acknowledgement remains separate; valid changes auto-confirm and unavailable changes preserve the booking');
 await saveMode(false); await saveMode(false,true);
 const repeated=ok(await create()); assert.equal(repeated.reservationDetails.status,'confirmed'); assert.equal(repeated.reservationDetails.date,later);
 const manual=ok(await request('/api/send-confirmation',{formData:{...formData,name:'Synthetic Manual Confirmation'}},{cookie:phoneCookie,key:randomUUID()})); fixtures.push(manual.reservationId); assert.equal(manual.reservationDetails.status,'pending');
 await saveMode(true); assert.equal((await db.doc(`reservations/${manual.reservationId}`).get()).data().status,'pending');
 const changed=ok(await request(`/api/reservations/${manual.reservationId}`,{action:'reschedule',date:later,time:newSlots[0].time,version:1},{token:tokenOf(manual)})); assert.equal(changed.reservation.status,'confirmed');
 await saveMode(false);
 const changedManual=ok(await request(`/api/reservations/${manual.reservationId}`,{action:'reschedule',date,time:slots[0].time,version:changed.reservation.version},{token:tokenOf(manual)})); assert.equal(changedManual.reservation.status,'pending');
 console.log('PASS manual mode works, old staff forms preserve it, existing bookings retain status, and retry receipts reflect saved changes');
 await generalRef.update({autoConfirmReservations:'false'});
 assert.equal((await request(`/api/availability/settings?date=${date}`)).status,503);
 assert.equal((await request('/api/send-confirmation',{formData},{cookie:phoneCookie,key:randomUUID()})).status,503);
 console.log('PASS malformed confirmation policy fails closed');
 await generalRef.set(original);
 for (const id of fixtures) {
  const r=await request(`/api/staff/reservations/${id}`,{action:'cancel'},{cookie:staffCookie}); ok(r);
 }
 console.log('Automatic-confirmation staging checks passed; synthetic fixtures cancelled.');
} finally { await generalRef.set(original); if(staffCookie) await request('/api/auth/logout',{}, {cookie:staffCookie}); }
