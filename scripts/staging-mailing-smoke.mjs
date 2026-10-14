import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { randomUUID, createHmac } from 'node:crypto';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const config = dotenv.parse(readFileSync('.env.staging.local'));
const base = process.env.MAILING_SMOKE_URL || 'http://127.0.0.1:3108';
assert.equal(new URL(base).hostname, '127.0.0.1');
assert.equal(config.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 'tablego-staging-1d712');
const credential = JSON.parse(readFileSync(config.GOOGLE_APPLICATION_CREDENTIALS));
assert.equal(credential.project_id, 'tablego-staging-1d712');
const db = getFirestore(initializeApp({ projectId: credential.project_id, credential: cert(credential) }));
db.settings({ preferRest: true });
const email = `qa-mailing-smoke-${randomUUID()}@example.invalid`;
const id = createHmac('sha256', config.ADMIN_SESSION_SECRET).update(`tablego-mailing:${email}`).digest('hex');
const contact = db.doc(`mailingContacts/${id}`), signup = { email, consent: true, consentVersion: '2026-10-14', source: 'banner', website: '' };
let cookie;
async function request(path, body, options = {}) {
  const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', ...options,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...options.headers }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000) });
  const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, response };
}
const ok = (result, expected) => { assert.equal(result.status, expected, `Expected HTTP ${expected}`); return result; };
const preference = url => Object.fromEntries(new URLSearchParams(new URL(url).hash.slice(1)));
async function capture() {
  for (let attempt = 0; attempt < 20; attempt++) {
    for (const filename of readdirSync('.staging/outbox')) {
      const record = JSON.parse(readFileSync(`.staging/outbox/${filename}`));
      if (record.channel === 'email' && record.payload?.to === email) return record.payload;
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw Error('No captured signup confirmation arrived.');
}
try {
  ok(await request('/api/staff/mailing'), 401);
  ok(await request('/api/staff/mailing/export', {}), 401);
  ok(await request('/api/mailing/signup', { ...signup, consent: false }), 400);
  ok(await request('/api/mailing/signup', signup, { headers: { Origin: 'https://foreign.example.invalid' } }), 403);
  ok(await request('/api/mailing/signup', { ...signup, website: 'bot' }), 200);
  assert.equal((await contact.get()).exists, false);
  ok(await request('/api/mailing/signup', signup), 200);
  assert.equal((await contact.get()).data().status, 'pending');
  const message = await capture(), urls = message.text.match(/http[^\s]+/g);
  const confirm = preference(urls.find(url => url.includes('action=confirm'))), unsubscribe = preference(urls.find(url => url.includes('action=unsubscribe')));
  assert.ok(message.text.includes('543 Emerson St')); assert.ok(!message.html.includes('<img'));
  ok(await request('/api/mailing/preferences', { ...confirm, token: 'invalid' }), 403);
  const login = ok(await request('/api/auth/login', { username: config.ADMIN_USERNAME, password: config.ADMIN_PASSWORD, remember: false }), 200);
  cookie = login.response.headers.get('set-cookie').split(';')[0];
  let list = ok(await request('/api/staff/mailing'), 200).data;
  assert.equal(list.contacts.find(c => c.id === id).status, 'pending');
  let exported = ok(await request('/api/staff/mailing/export', {}), 200).data;
  assert.ok(!exported.includes(email));
  ok(await request('/api/mailing/preferences', confirm), 200);
  ok(await request('/api/mailing/preferences', confirm), 200);
  assert.equal((await contact.get()).data().status, 'subscribed');
  exported = ok(await request('/api/staff/mailing/export', {}), 200).data;
  assert.ok(exported.includes(email)); assert.ok(exported.includes('action=unsubscribe'));
  list = ok(await request('/api/staff/mailing'), 200).data;
  for (const item of list.contacts.filter(c => c.status !== 'subscribed')) assert.ok(!exported.includes(`"${item.email}"`));
  ok(await request('/api/mailing/preferences', unsubscribe), 200);
  ok(await request('/api/mailing/preferences', confirm), 410);
  assert.equal((await contact.get()).data().status, 'unsubscribed');
  exported = ok(await request('/api/staff/mailing/export', {}), 200).data;
  assert.ok(!exported.includes(email));
  const intents = await db.collection('notificationOutbox').where('entityId', '==', id).get();
  assert.equal(intents.size, 1); assert.equal(intents.docs[0].data().deliveryMode, 'capture');
  writeFileSync('.staging/mailing-smoke-result.json', JSON.stringify({ id, project: credential.project_id, passed: true, notificationMode: 'capture', timestamp: new Date().toISOString() }), { mode: 0o600 });
  console.log('PASS staging signup, recorded consent, captured confirmation, guarded export, immediate unsubscribe, and stale-link protection.');
} finally {
  if (cookie) await request('/api/auth/logout', {});
  // Preserve this synthetic opt-out as reviewable evidence; no production data is changed.
}
