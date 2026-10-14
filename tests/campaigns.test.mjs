import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as policy from '../src/lib/campaigns/policy.ts';
import { renderCampaign } from '../src/lib/campaigns/render.ts';
import * as tokens from '../src/lib/reservations/managementToken.ts';
import { restaurantIdentity, defaultRestaurant } from '../src/lib/restaurant/config.ts';
process.env.ADMIN_SESSION_SECRET = 'synthetic-campaign-test-secret-not-for-production';
process.env.NEXT_PUBLIC_BASE_URL = 'https://test.example.invalid';
function harness(options = {}) {
  let now = Date.parse('2026-10-14T18:30:00Z');
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const records = new Map([['settings/general', { timezone: 'America/Los_Angeles' }]]), sent = [], removed = Symbol('remove');
  const clone = value => structuredClone(value);
  const ref = path => ({ path, id: path.split('/').at(-1), collection: name => collection(`${path}/${name}`) });
  function collection(path, filters = [], limit = 100) { return { path, filters, limitCount: limit, doc: id => ref(`${path}/${id}`), where: (key, op, value) => collection(path, [...filters, [key, op, value]], limit), limit: value => collection(path, filters, value), orderBy: () => collection(path, filters, limit), get: async () => snapshot(collection(path, filters, limit)) }; }
  function snapshot(reference) {
    if ('filters' in reference) { const docs = [...records].filter(([path, data]) => path.startsWith(reference.path + '/') && path.split('/').length === reference.path.split('/').length + 1 && reference.filters.every(([key, op, value]) => op === 'in' ? value.includes(data[key]) : data[key] === value)).slice(0, reference.limitCount).map(([path]) => snapshot(ref(path))); return { docs, size: docs.length }; }
    return { ref: reference, id: reference.id, exists: records.has(reference.path), data: () => records.has(reference.path) ? clone(records.get(reference.path)) : undefined };
  }
  let queue = Promise.resolve();
  const db = { doc: ref, collection, runTransaction: work => { const result = queue.then(async () => {
    const changes = []; let writing = false;
    const write = (reference, data, merge) => { writing = true; changes.push([reference, data, merge]); };
    const value = await work({ get: async reference => { assert.equal(writing, false, 'Firestore reads must precede writes'); return snapshot(reference); }, set: (r, d, o) => write(r, d, o?.merge), update: (r, d) => write(r, d, true), create: (r, d) => { assert.ok(!records.has(r.path)); write(r, d, false); } });
    for (const [reference, data, merge] of changes) { const next = { ...(merge ? records.get(reference.path) : {}), ...data }; for (const key of Object.keys(next)) { assert.notEqual(next[key], undefined, `Undefined Firestore field ${key}`); if (next[key] === removed) delete next[key]; } records.set(reference.path, next); }
    return value;
  }); queue = result.catch(() => {}); return result; } };
  class ReservationError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
  const contactId = () => 'test-contact-id';
  const imports = { '../serverFirebase': { getServerDatabase: () => db }, '../restaurant/config': { restaurantIdentity }, '../notificationTransport': { capturesNotifications: () => options.capture !== false, createEmailTransport: () => ({ sendMail: async message => { sent.push(message); if (options.onSend) await options.onSend(); if (options.fail) throw Error('Synthetic failure'); return { captured: options.capture !== false, messageId: 'synthetic-message', ...(options.reject ? { rejected: [policy.TEST_RECIPIENT] } : {}) }; } }) }, '../mailing/repository': { contactId }, '../reservations/managementToken': tokens, '../reservations/http': { ReservationError }, './policy': policy, './render': { renderCampaign }, './provider': { campaignProvider: () => options.provider || 'smtp', assertCampaignProvider: () => { if (options.badConfig) throw Error('Synthetic missing config'); }, sendResend: async () => { sent.push({ to: policy.TEST_RECIPIENT, provider: 'resend' }); return 'resend-message'; } }, 'firebase-admin/firestore': { FieldValue: { delete: () => removed } } };
  function load(path) { const file = new URL(path, import.meta.url), require = createRequire(file), module = { exports: {} }; runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports, require: name => imports[name] || require(name), process, Date: Clock, URL, Buffer }); return module.exports; }
  const api = load('../src/lib/campaigns/repository.ts'), webhook = load('../src/lib/campaigns/webhook.ts');
  const campaign = id => records.get(`emailCampaigns/${id}`), recipient = () => records.get('campaignRecipients/test-contact-id');
  async function create() { const id = await api.saveCampaign(policy.recommendedCampaign()); await api.changeCampaign(id, campaign(id).version, 'launch'); return id; }
  return { api, webhook, records, sent, campaign, recipient, create, advance: value => { now += value; } };
}
test('campaign validation enforces useful cadence, bounded copy, and safe destinations', () => {
  const draft = policy.recommendedCampaign(); assert.deepEqual(policy.campaignInput(draft).touchpoints.map(p => p.day), [0, 7, 21]);
  for (const change of [{ day: 0 }, { day: 6 }, { day: 91 }, { path: 'https://evil.invalid' }, { subject: 'Hello\r\nBcc:other' }, { expiresOn: '2026-02-30' }]) { const bad = structuredClone(draft); Object.assign(bad.touchpoints[1], change); assert.throws(() => policy.campaignInput(bad)); }
});
test('business dates remain stable across viewer timezones and DST', () => {
  for (const zone of ['UTC', 'Asia/Tokyo', 'Europe/London', 'America/New_York']) { process.env.TZ = zone; assert.equal(policy.localDate(new Date('2026-11-01T07:30:00Z'), 'America/Los_Angeles'), '2026-11-01'); assert.equal(policy.addDays('2026-10-28', 7), '2026-11-04'); }
  delete process.env.TZ;
});
test('launch fixes recipient server-side, records owner authorization, and blocks concurrent test campaigns', async () => {
  const h = harness(), id = await h.create(); assert.equal(h.campaign(id).recipient, policy.TEST_RECIPIENT); assert.equal(h.recipient().authorization, 'owner-requested-single-recipient-test');
  assert.equal(h.records.has('mailingContacts/test-contact-id'), false);
  const other = await h.api.saveCampaign({ ...policy.recommendedCampaign(), recipient: 'someone@example.invalid' });
  assert.equal(h.campaign(other).recipient, policy.TEST_RECIPIENT);
  await assert.rejects(h.api.changeCampaign(other, 1, 'launch'), error => error.status === 409);
  h.campaign(other).recipient = 'someone@example.invalid'; await assert.rejects(h.api.changeCampaign(other, 1, 'launch'));
  assert.equal(h.sent.length, 0);
});
test('concurrent delivery and repeated launch cannot duplicate the first touchpoint', async () => {
  const h = harness(), id = await h.create();
  await Promise.all([h.api.deliverCampaign(id, true), h.api.deliverCampaign(id, true)]);
  assert.equal(h.sent.length, 1); assert.equal(h.sent[0].to, policy.TEST_RECIPIENT); assert.equal(h.sent[0].cc, undefined); assert.equal(h.sent[0].bcc, undefined);
  assert.equal(h.campaign(id).messages[0].state, 'captured');
  await assert.rejects(h.api.changeCampaign(id, 1, 'launch'), error => error.status === 409);
  await h.api.deliverCampaign(id, true); assert.equal(h.sent.length, 1);
});
test('pause, unsubscribe, historical suppression, and cancelled states stop future sends', async () => {
  for (const action of ['pause', 'cancel', 'unsubscribe', 'mailing-suppression']) {
    const h = harness(), id = await h.create();
    if (action === 'unsubscribe') { const token = tokens.decryptToken(h.recipient().encryptedUnsubscribe); await h.api.unsubscribeCampaign(token); assert.equal(h.records.get('mailingAccess/test-contact-id').confirmationVersion, -1); assert.equal(h.records.get('mailingContacts/test-contact-id').status, 'unsubscribed'); }
    else if (action === 'mailing-suppression') h.records.set('mailingContacts/test-contact-id', { status: 'unsubscribed' });
    else await h.api.changeCampaign(id, h.campaign(id).version, action);
    await h.api.deliverCampaign(id, true); assert.equal(h.sent.length, 0);
  }
});
test('a resumed campaign preserves spacing rather than sending overdue emails back to back', async () => {
  const h = harness(), id = await h.create(); await h.api.deliverCampaign(id, true); h.advance(30 * 86400000);
  await h.api.deliverCampaign(id); assert.equal(h.sent.length, 2); assert.equal(h.campaign(id).messages[2].dueOn, '2026-11-27');
  await h.api.deliverCampaign(id); assert.equal(h.sent.length, 2);
});
test('expired offers are blocked at launch and skipped if expiry passes before delivery', async () => {
  const h = harness(), id = await h.create(); h.advance(70 * 86400000); await h.api.deliverCampaign(id); assert.equal(h.campaign(id).messages[0].state, 'skipped'); assert.equal(h.sent.length, 0);
  const other = harness(); other.advance(70 * 86400000); await assert.rejects(other.create(), /offer expires/i);
});
test('ambiguous SMTP failure pauses without retry; staff can skip after reviewing the inbox', async () => {
  const h = harness({ fail: true }), id = await h.create(); await h.api.deliverCampaign(id, true); assert.equal(h.campaign(id).status, 'paused'); assert.equal(h.campaign(id).messages[0].state, 'uncertain');
  await h.api.deliverCampaign(id, true); assert.equal(h.sent.length, 1);
  await assert.rejects(h.api.changeCampaign(id, h.campaign(id).version, 'resume'), /Resolve/);
  await h.api.changeCampaign(id, h.campaign(id).version, 'skip', 0); await h.api.changeCampaign(id, h.campaign(id).version, 'resume'); assert.equal(h.campaign(id).status, 'running');
});
test('stale interrupted sends are recoverable after pause, without a resend', async () => {
  const h = harness(), id = await h.create(); h.campaign(id).messages[0].state = 'sending'; await h.api.changeCampaign(id, h.campaign(id).version, 'pause'); h.advance(121000);
  await h.api.changeCampaign(id, h.campaign(id).version, 'review'); assert.equal(h.campaign(id).messages[0].state, 'uncertain'); assert.equal(h.sent.length, 0);
});
test('completion of an old cancelled send does not release a newer campaign recipient lock', async () => {
  let h, newer;
  h = harness({ onSend: async () => { const old = [...h.records.values()].find(c => c.status === 'running' && c.touchpoints); await h.api.changeCampaign(old.id, old.version, 'cancel'); newer = await h.create(); } });
  const id = await h.create(); await h.api.deliverCampaign(id, true); assert.equal(h.campaign(id).status, 'cancelled'); assert.equal(h.recipient().activeCampaignId, newer);
});
test('campaign email is escaped, mobile friendly, and includes sender identity plus opt-out', () => {
  const p = { ...policy.recommendedCampaign().touchpoints[0], heading: '<script>unsafe</script>' };
  const result = renderCampaign(p, defaultRestaurant, policy.TEST_RECIPIENT, 'https://test.invalid/mailing/#token=private', 'https://test.invalid');
  assert.ok(!result.html.includes('<script>')); assert.match(result.html, /&lt;script&gt;/); assert.match(result.html, /max-width:560px/); assert.match(result.text, /543 Emerson St/); assert.match(result.text, /Unsubscribe/); assert.match(result.text, /excludes takeout/i);
});
test('verified provider events deduplicate metrics, tolerate out-of-order delivery, and suppress hard bounces', async () => {
  const h = harness({ provider: 'resend', capture: false }), id = await h.create(); await h.api.deliverCampaign(id, true);
  const event = type => ({ type, created_at: '2026-10-14T19:00:01Z', data: { email_id: 'resend-message', to: [policy.TEST_RECIPIENT], tags: { tablego_campaign: id, touchpoint: '0' } } });
  await h.webhook.applyCampaignWebhook(event('email.delivered'), 'evt-delivered'); await h.webhook.applyCampaignWebhook(event('email.delivered'), 'evt-delivered'); await h.webhook.applyCampaignWebhook(event('email.sent'), 'evt-sent');
  assert.equal(policy.campaignMetrics([h.campaign(id)]).delivered, 1);
  await h.webhook.applyCampaignWebhook(event('email.bounced'), 'evt-bounced'); assert.equal(h.recipient().suppressed, true); assert.equal(h.campaign(id).status, 'paused');
  await h.api.deliverCampaign(id); assert.equal(h.sent.length, 1);
  const forged = event('email.opened'); forged.data.email_id = 'unrelated'; await h.webhook.applyCampaignWebhook(forged, 'evt-wrong'); assert.equal(policy.campaignMetrics([h.campaign(id)]).opened, 0);
});
// Load the server transport with a capture guard rather than importing Next/Firebase.
function provider() {
  const file = new URL('../src/lib/campaigns/provider.ts', import.meta.url), module = { exports: {} }, require = createRequire(file);
  runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports, require: name => name === '../notificationTransport' ? { capturesNotifications: () => true } : require(name), process, Buffer, Date }); return module.exports;
}
test('Resend signatures require exact raw content, a recent timestamp, and the correct signing secret', () => {
  const api = provider(), secret = 'whsec_' + Buffer.from('synthetic-webhook-secret-32-bytes').toString('base64'), raw = '{"type":"email.delivered"}', timestamp = String(Math.floor(Date.now() / 1000)), id = 'msg_synthetic';
  const signature = createHmac('sha256', Buffer.from(secret.slice(6), 'base64')).update(`${id}.${timestamp}.${raw}`).digest('base64');
  const headers = new Headers({ 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,invalid v1,${signature}` });
  assert.equal(api.verifyWebhook(raw, headers, secret), true); assert.equal(api.verifyWebhook(raw + ' ', headers, secret), false); assert.equal(api.verifyWebhook(raw, headers, secret, Date.now() + 301000), false); assert.equal(api.verifyWebhook(raw, headers, 'whsec_wrong'), false);
});
test('recommended drafts retire the lunch offer after its restaurant-local expiry', () => {
  const next = policy.recommendedCampaign(new Date('2026-12-13T08:00:00Z')); assert.ok(!JSON.stringify(next).includes('10%')); assert.equal(next.touchpoints[0].day, 0); assert.deepEqual(next.touchpoints.map(p => p.day), [0, 7, 21]);
});
test('daily sends honor the documented UTC window, while the explicit launch can send immediately', () => {
  const c = { ...policy.recommendedCampaign(), recipient: policy.TEST_RECIPIENT, status: 'running', timezone: 'America/Los_Angeles', messages: [{ state: 'pending', dueOn: '2026-10-14' }] };
  assert.equal(policy.dueTouchpoint(c, new Date('2026-10-14T23:00:00Z')), -1); assert.equal(policy.dueTouchpoint(c, new Date('2026-10-14T18:30:00Z')), 0); assert.equal(policy.dueTouchpoint(c, new Date('2026-10-14T23:00:00Z'), true), 0);
});
test('repeated unsubscribe is idempotent and still invalidates a fresh pending confirmation', async () => {
  const h = harness(), id = await h.create(), token = tokens.decryptToken(h.recipient().encryptedUnsubscribe);
  await h.api.unsubscribeCampaign(token); const size = h.records.size, version = h.records.get('mailingContacts/test-contact-id').version;
  await h.api.unsubscribeCampaign(token); assert.equal(h.records.size, size); assert.equal(h.records.get('mailingContacts/test-contact-id').version, version);
  h.records.set('mailingAccess/test-contact-id', { confirmationVersion: 99 }); await h.api.unsubscribeCampaign(token); assert.equal(h.records.get('mailingAccess/test-contact-id').confirmationVersion, -1);
  assert.equal(h.campaign(id).status, 'paused');
});
test('a late bounce on a reviewed send still suppresses the recipient and pauses a newer campaign', async () => {
  const h = harness({ provider: 'resend', capture: false }), id = await h.create(); await h.api.deliverCampaign(id, true);
  await h.api.changeCampaign(id, h.campaign(id).version, 'cancel'); h.campaign(id).messages[0].state = 'skipped';
  const newer = await h.create();
  await h.webhook.applyCampaignWebhook({ type: 'email.bounced', data: { email_id: 'resend-message', to: [policy.TEST_RECIPIENT], tags: { tablego_campaign: id, touchpoint: '0' } } }, 'late-event');
  assert.equal(h.recipient().suppressed, true); assert.equal(h.campaign(newer).status, 'paused'); assert.equal(h.campaign(id).status, 'cancelled');
});
