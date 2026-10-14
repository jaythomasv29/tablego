import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const config = dotenv.parse(readFileSync('.env.staging.local')), base = 'http://127.0.0.1:3108';
assert.equal(config.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 'tablego-staging-1d712');
const credentials = JSON.parse(readFileSync(config.GOOGLE_APPLICATION_CREDENTIALS)); assert.equal(credentials.project_id, 'tablego-staging-1d712');
const db = getFirestore(initializeApp({ projectId: credentials.project_id, credential: cert(credentials) })); db.settings({ preferRest: true });
const contactId = createHmac('sha256', config.ADMIN_SESSION_SECRET).update('tablego-mailing:thaiphoonpaloalto@gmail.com').digest('hex');
const recipientRef = db.doc(`campaignRecipients/${contactId}`), contactRef = db.doc(`mailingContacts/${contactId}`), accessRef = db.doc(`mailingAccess/${contactId}`);
const originals = await Promise.all([recipientRef, contactRef, accessRef].map(ref => ref.get()));
const eventsBefore = new Set((await contactRef.collection('events').get()).docs.map(doc => doc.id));
let cookie, id;
async function request(path, body, headers = {}) {
  const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  let data; try { data = await response.json(); } catch { data = {}; } return { status: response.status, response, data };
}
function ok(result, status = 200) { assert.equal(result.status, status, result.data.error); return result; }
const get = async () => ok(await request('/api/staff/campaigns')).data.campaigns.find(c => c.id === id);
try {
  ok(await request('/api/staff/campaigns'), 401); ok(await request('/api/staff/campaigns', { action: 'launch' }), 401);
  const login = ok(await request('/api/auth/login', { username: config.ADMIN_USERNAME, password: config.ADMIN_PASSWORD, remember: false })); cookie = login.response.headers.get('set-cookie').split(';')[0];
  const setup = ok(await request('/api/staff/campaigns')).data;
  ok(await request('/api/staff/campaigns', { action: 'save', campaign: setup.recommended }, { Origin: 'https://foreign.invalid' }), 403);
  const saved = ok(await request('/api/staff/campaigns', { action: 'save', campaign: { ...setup.recommended, name: 'QA · campaign smoke · captured only', recipient: 'forged@example.invalid' } })); id = saved.data.id;
  let campaign = await get(); assert.equal(campaign.recipient, 'thaiphoonpaloalto@gmail.com');
  ok(await request('/api/staff/campaigns', { action: 'launch', id, version: campaign.version }));
  for (let attempt = 0; attempt < 25; attempt++) { campaign = await get(); if (campaign.messages[0].state === 'captured') break; await new Promise(resolve => setTimeout(resolve, 300)); }
  assert.equal(campaign.messages[0].state, 'captured');
  ok(await request('/api/staff/campaigns', { action: 'launch', id, version: 1 }), 409);
  ok(await request('/api/staff/campaigns', { action: 'pause', id, version: campaign.version })); campaign = await get(); assert.equal(campaign.status, 'paused');
  ok(await request('/api/staff/campaigns', { action: 'resume', id, version: campaign.version })); campaign = await get(); assert.equal(campaign.status, 'running');
  const capture = readdirSync('.staging/outbox').map(name => JSON.parse(readFileSync(`.staging/outbox/${name}`))).find(item => item.payload?.messageId?.includes(`tablego-campaign-${id}-0`));
  assert.ok(capture); assert.equal(capture.payload.to, 'thaiphoonpaloalto@gmail.com'); assert.ok(!capture.payload.cc && !capture.payload.bcc);
  const optout = capture.payload.text.match(/http[^\s]+\/mailing\/campaign-preferences#token=[^\s]+/)[0];
  const token = new URLSearchParams(new URL(optout).hash.slice(1)).get('token');
  ok(await request('/api/campaigns/unsubscribe', { token: 'forged' }), 400);
  ok(await request('/api/campaigns/unsubscribe', { token })); campaign = await get(); assert.equal(campaign.status, 'paused');
  ok(await request('/api/staff/campaigns', { action: 'resume', id, version: campaign.version }), 409);
  assert.equal((await recipientRef.get()).data().suppressed, true);
  assert.equal((await contactRef.get()).data().status, 'unsubscribed');
  ok(await request('/api/staff/campaigns', { action: 'cancel', id, version: campaign.version }));
  writeFileSync('.staging/campaign-smoke-result.json', JSON.stringify({ id, passed: true, project: credentials.project_id, notificationMode: 'capture', timestamp: new Date().toISOString() }), { mode: 0o600 });
  console.log('PASS isolated staging: staff/origin guards, fixed recipient, captured email, stale launch rejection, pause/resume, unsubscribe suppression, and cancellation. No real email sent.');
} finally {
  if (id) { const snapshot = await db.doc(`emailCampaigns/${id}`).get(); if (['running', 'paused'].includes(snapshot.data()?.status)) await request('/api/staff/campaigns', { action: 'cancel', id, version: snapshot.data().version }); }
  if (cookie) await request('/api/auth/logout', {});
  // Restore only the named test recipient's staging fixtures; retain this cancelled QA campaign as evidence.
  for (const snapshot of originals) { if (snapshot.exists) await snapshot.ref.set(snapshot.data()); else await snapshot.ref.delete(); }
  for (const event of (await contactRef.collection('events').get()).docs) if (!eventsBefore.has(event.id)) await event.ref.delete();
}
