import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { marketingTestInput } from '../src/lib/marketing/testInput.ts';
import { marketingCopy, marketingTestMessage, renderMarketingTestNotification } from '../src/lib/marketing/render.ts';
import { restaurantIdentity } from '../src/lib/restaurant/config.ts';
const require = createRequire(import.meta.url);
function load(path, mocks) {
  const module = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports, process, Date, URL, require: name => name in mocks ? mocks[name] : require(name) });
  return module.exports;
}
const valid = { kind: 'reservation', name: '', email: ' Boss@Example.com ', key: '11111111-1111-4111-8111-111111111111', configurationVersion: 'a'.repeat(64) };
test('test form accepts a single email and optional name without accepting mailing lists or header injection', () => {
  assert.equal(marketingTestInput(valid).email, 'boss@example.com');
  assert.equal(marketingTestInput(valid).name, 'Guest');
  for (const details of [{ email: '' }, { email: 'a@example.com,b@example.com' }, { email: 'a@example.com\r\nBcc:b@example.com' }, { name: 'Name\r\nBcc' }, { name: 'x'.repeat(121) }, { kind: 'sms' }, { key: 'invalid' }, { configurationVersion: '' }]) assert.throws(() => marketingTestInput({ ...valid, ...details }));
});
test('test rendering previews the real follow-up copy, marks TEST, and never inserts a live unsubscribe action', () => {
  for (const kind of ['reservation', 'catering']) {
    const copy = marketingCopy({ kind, name: '<boss>' }, restaurantIdentity({}), 'https://example.com');
    const message = renderMarketingTestNotification({ ...copy, email: 'boss@example.com' });
    assert.ok(message.subject.startsWith('[TEST] '));
    assert.ok(message.html.includes('&lt;boss&gt;'));
    assert.ok(!message.html.includes('<boss>'));
    assert.ok(message.text.includes(copy.body));
    assert.ok(!message.html.includes('/unsubscribe'));
    assert.equal(message.headers, undefined);
    assert.equal(message.to, 'boss@example.com');
    assert.equal(message.html, marketingTestMessage(copy).html);
  }
});
function fixture() {
  const records = new Map([['settings/general', { restaurant: {} }]]), writes = [];
  const db = { doc: path => ({ path, get: async () => ({ data: () => records.get(path) }) }), runTransaction: async work => work({ get: async ref => ({ data: () => records.get(ref.path) }), create: (ref, data) => { assert.ok(!records.has(ref.path)); records.set(ref.path, data); writes.push(ref.path); } }) };
  class ReservationError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const repository = load('../src/lib/marketing/testRepository.ts', { '../serverFirebase': { getServerDatabase: () => db }, '../restaurant/config': { restaurantIdentity }, '../reservations/http': { ReservationError }, './render': { marketingCopy, marketingTestMessage }, './testInput': { marketingTestInput } });
  return { db, records, writes, repository };
}
test('test queue is idempotent, detects stale previews, and writes only its own outbox record', async t => {
  const oldUrl = process.env.NEXT_PUBLIC_BASE_URL;
  process.env.NEXT_PUBLIC_BASE_URL = 'https://example.com';
  t.after(() => { if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_BASE_URL; else process.env.NEXT_PUBLIC_BASE_URL = oldUrl; });
  const { records, writes, repository } = fixture();
  const config = await repository.marketingTestConfiguration();
  assert.equal(writes.length, 0, 'opening a preview never queues email');
  const details = { ...valid, configurationVersion: config.configurationVersion };
  const result = await repository.queueMarketingTest(details, 'staff-session');
  assert.equal(writes.length, 1);
  assert.ok(writes[0].startsWith('notificationOutbox/marketing-test-'));
  assert.equal(records.get(writes[0]).email, 'boss@example.com');
  assert.equal(records.get(writes[0]).kind, 'marketing-test');
  const repeat = await repository.queueMarketingTest(details, 'staff-session');
  assert.equal(repeat.id, result.id); assert.equal(writes.length, 1);
  await assert.rejects(repository.queueMarketingTest({ ...details, email: 'other@example.com' }, 'staff-session'), /different details/);
  await assert.rejects(repository.queueMarketingTest({ ...details, configurationVersion: 'b'.repeat(64) }, 'staff-session'), /preview changed/);
  assert.equal((await repository.marketingTestStatus(result.id, 'staff-session')).state, 'queued');
  await assert.rejects(repository.marketingTestStatus(result.id, 'different-session'), /not found/);
});
test('test delivery uses the shared mail pipeline without reading or changing customers, preferences, or campaigns', async t => {
  const previous = process.env.NEXT_PUBLIC_BASE_URL;
  process.env.NEXT_PUBLIC_BASE_URL = 'https://example.com';
  t.after(() => { if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_URL; else process.env.NEXT_PUBLIC_BASE_URL = previous; });
  for (const fail of [false, true]) {
    const path = 'notificationOutbox/marketing-test-synthetic';
    const records = new Map([[path, { kind: 'marketing-test', email: 'boss@example.com', subject: 'Welcome back', body: 'Hello Guest', state: 'queued', attempts: 0, channel: 'email', nextAttemptAt: { toMillis: () => 0 } }], ['settings/general', {}]]);
    const reads = [], writes = [], sent = [];
    const snapshot = path => { reads.push(path); return { data: () => records.get(path) }; };
    const db = { doc: path => ({ path, get: async () => snapshot(path) }), runTransaction: async work => work({ get: async ref => snapshot(ref.path), update: (ref, data) => { writes.push(ref.path); records.set(ref.path, { ...records.get(ref.path), ...data }); } }) };
    const notifications = load('../src/lib/reservations/notifications.ts', {
      '../marketing/repository': { marketingSnapshot: () => assert.fail('must not read customer eligibility') }, '../marketing/render': { renderMarketingTestNotification }, '../restaurant/config': { restaurantIdentity },
      '../serverFirebase': { getServerDatabase: () => db }, '../notificationTransport': { createEmailTransport: () => ({ sendMail: async message => { sent.push(message); if (fail) throw Error('synthetic outage'); return { captured: true, messageId: 'synthetic-capture' }; } }) },
      './render': {}, '../catering/notification': {}, '../mailing/render': {}, './shareRender': {}, './feedbackRender': {}, './sharing': {}, './domain': {}, '../twilio': {}, '../formatting/html': {},
    });
    assert.equal(await notifications.deliverNotification('marketing-test-synthetic'), fail ? 'failed' : 'delivered');
    assert.equal(sent.length, 1); assert.equal(sent[0].to, 'boss@example.com');
    assert.ok(sent[0].subject.startsWith('[TEST]'));
    assert.ok(reads.every(path => path.startsWith('notificationOutbox/') || path === 'settings/general'));
    assert.ok(writes.every(path => path.startsWith('notificationOutbox/')));
    if (!fail) assert.equal(records.get(path).deliveryMode, 'capture');
  }
});
test('test routes reject anonymous callers before previewing, queuing, or scheduling delivery', async () => {
  const denied = { status: 401 };
  const route = load('../src/app/api/staff/marketing/test/route.ts', {
    'next/server': { after: () => assert.fail('no anonymous sends') }, '@/lib/auth/admin': { requireAdmin: async () => denied }, '@/lib/auth/rateLimit': {}, '@/lib/reservations/http': {}, '@/lib/reservations/notifications': {}, '@/lib/marketing/testRepository': {},
  });
  assert.equal(await route.GET({}), denied); assert.equal(await route.POST({}), denied);
});
