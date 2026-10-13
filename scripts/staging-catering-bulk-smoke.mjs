import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { initializeApp, cert, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const env = dotenv.parse(await readFile('.env.staging.local')), credentials = JSON.parse(await readFile(env.GOOGLE_APPLICATION_CREDENTIALS));
assert.equal(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 'tablego-staging-1d712'); assert.equal(credentials.project_id, env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
const app = initializeApp({ projectId: credentials.project_id, credential: cert(credentials) }, randomUUID()), db = getFirestore(app);
const base = 'http://127.0.0.1:3107', run = randomUUID(), ownedIds = [];
let cookie;
async function request(path, body, { auth = true, origin = base, method = 'POST' } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json', Origin: origin } : {}), ...(auth && cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
const ok = value => { assert.equal(value.status, 200, value.data.error); return value.data; };
async function seed(suffix, stage) {
  const id = `bulk-close-${run}-${suffix}`; ownedIds.push(id);
  await db.doc(`catering/${id}`).create({ name: `BULK CLOSE STAGING CHECK ${suffix}`, status: 'pending', date: '2026-11-15', partySize: '20', budget: '$1000', specialRequests: 'Original guest request', createdAt: new Date('2001-01-01T12:00:00Z'), isTest: true });
  await db.doc(`cateringStaff/${id}`).create({ workflowStage: stage, internalNotes: `Private ${suffix} note`, followUpDate: '2026-10-12', version: 2 });
  return id;
}
async function ownedReview(ids) {
  const preview = ok(await request('/api/staff/catering/bulk-close', { action: 'preview' }));
  assert.ok(ids.every(id => preview.items.some(item => item.id === id)));
  // Narrow only the private test receipt, through the staging service account.
  // This leaves unrelated staging inquiries untouched; production exposes no subset override.
  const ref = db.doc(`cateringBulkClosures/${preview.operationId}`), operation = (await ref.get()).data();
  const items = operation.items.filter(item => ids.includes(item.id));
  await ref.update({ items, totalActive: items.length });
  return preview.operationId;
}
try {
  assert.equal((await request('/api/staff/catering/bulk-close', { action: 'preview' }, { auth: false })).status, 401);
  cookie = (await request('/api/auth/login', { username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD }, { auth: false })).cookie; assert.ok(cookie);
  assert.equal((await request('/api/staff/catering/bulk-close', { action: 'preview' }, { origin: 'https://foreign.example.invalid' })).status, 403);
  const a = await seed('new', 'pending'), b = await seed('contacted', 'contacted'), c = await seed('confirmed', 'confirmed'), selected = [a, b, c];
  const stale = await ownedReview(selected);
  await db.doc(`cateringStaff/${b}`).update({ internalNotes: 'Concurrent private note change' });
  assert.equal((await request('/api/staff/catering/bulk-close', { action: 'confirm', operationId: stale })).status, 409);
  for (const id of selected) assert.equal((await db.doc(`catering/${id}`).get()).data().status, 'pending');
  const fresh = await ownedReview(selected), arrival = await seed('arrival', 'pending');
  const result = ok(await request('/api/staff/catering/bulk-close', { action: 'confirm', operationId: fresh }));
  assert.equal(result.closedCount, 3); assert.equal(result.ids.length, 3);
  for (const id of selected) {
    const raw = (await db.doc(`catering/${id}`).get()).data(), staff = (await db.doc(`cateringStaff/${id}`).get()).data();
    assert.equal(raw.status, 'completed'); assert.equal(raw.specialRequests, 'Original guest request'); assert.equal(raw.internalNotes, undefined);
    assert.equal(staff.workflowStage, 'completed'); assert.equal(staff.followUpDate, ''); assert.equal(staff.version, 3); assert.ok(staff.internalNotes);
    const detail = ok(await request(`/api/staff/catering/${id}`, undefined, { method: 'GET' })); assert.ok(detail.events.some(event => event.bulkClosed === true));
    assert.equal((await db.collection('notificationOutbox').where('entityId', '==', id).get()).size, 0);
  }
  assert.equal((await db.doc(`catering/${arrival}`).get()).data().status, 'pending');
  const retry = ok(await request('/api/staff/catering/bulk-close', { action: 'confirm', operationId: fresh })); assert.equal(retry.repeated, true);
  for (const id of selected) assert.equal((await db.doc(`cateringStaff/${id}`).get()).data().version, 3);
  assert.equal((await fetch(`https://firestore.googleapis.com/v1/projects/${credentials.project_id}/databases/(default)/documents/cateringBulkClosures/${fresh}`)).status, 403);
  console.log('PASS real staging bulk transaction, staff/origin guards, concurrent-change all-or-nothing rejection, exact reviewed IDs, new-arrival preservation, note/guest preservation, cleared follow-ups, history, safe retry and no message jobs');
} finally {
  if (cookie) {
    for (const id of ownedIds) {
      const detail = await request(`/api/staff/catering/${id}`, undefined, { method: 'GET' });
      if (detail.status === 200 && detail.data.lead.status !== 'completed') { const lead = detail.data.lead; ok(await request(`/api/staff/catering/${id}`, { status: 'completed', originalStatus: lead.status, version: lead.version, internalNotes: lead.internalNotes, followUpDate: '' }, { method: 'PATCH' })); }
    }
    await request('/api/auth/logout', {});
  }
  await writeFile('.staging/catering-bulk-fixtures.json', JSON.stringify({ ownedIds }), { mode: 0o600 });
  await deleteApp(app);
  console.log('Owned staging fixtures closed. Unrelated staging inquiries and all live inquiries unchanged.');
}
