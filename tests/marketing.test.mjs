import { cateringLead, cateringRecord } from '../src/lib/catering/admin.ts';
import { serviceReservation } from '../src/lib/reservations/service.ts';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { inactiveCustomers } from '../src/lib/marketing/policy.ts';
const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  runInNewContext(source, { module, exports: module.exports, process, Buffer, URL, Date, console,
    require: name => name in mocks ? mocks[name] : require(name) });
  return module.exports;
}
const record = (overrides = {}) => ({ id: 'booking', name: 'Guest', email: 'guest@example.com', date: '2026-09-01', status: 'completed', ...overrides });
test('eligibility is strictly over 30 restaurant calendar days, grouped by normalized email', () => {
  assert.equal(inactiveCustomers([record({ date: '2026-09-23' })], 'reservation', '2026-10-23').length, 0);
  const result = inactiveCustomers([record(), record({ id: 'new', date: '2026-09-22', email: ' Guest@Example.COM ' })], 'reservation', '2026-10-23');
  assert.equal(result.length, 1); assert.equal(result[0].inactiveDays, 31); assert.equal(result[0].lastDate, '2026-09-22');
});
test('recent, upcoming and same-day bookings suppress inactive follow-ups regardless of input order', () => {
  for (const date of ['2026-10-22', '2026-10-23', '2026-11-01']) {
    for (const records of [[record(), record({ id: 'new', date, status: 'confirmed' })], [record({ id: 'new', date, status: 'confirmed' }), record()]]) {
      assert.equal(inactiveCustomers(records, 'reservation', '2026-10-23').length, 0);
    }
  }
});
test('catering inquiries are not completed events, and upcoming inquiries suppress outreach', () => {
  assert.equal(inactiveCustomers([record({ status: 'pending' })], 'catering', '2026-10-23').length, 0);
  assert.equal(inactiveCustomers([record(), record({ date: '2026-11-01', status: 'pending' })], 'catering', '2026-10-23').length, 0);
  assert.equal(inactiveCustomers([record()], 'catering', '2026-10-23').length, 1);
});
test('cancelled, no-show, test, malformed and opted-out records never become recipients', () => {
  for (const change of [{ status: 'cancelled' }, { status: 'no-show' }, { isTest: true }, { date: '2026-02-30' }, { date: 'unknown' }, { email: 'bad' }, { marketingOptOut: true }]) {
    assert.equal(inactiveCustomers([record(change)], 'reservation', '2026-10-23').length, 0);
  }
  assert.equal(inactiveCustomers([record(), record({ date: 'bad' })], 'reservation', '2026-10-23').length, 0);
});

function fixture() {
  const records = new Map([
    ['settings/general', { timezone: 'America/Los_Angeles', restaurant: {} }],
    ['reservations/r1', record({ date: '2020-01-01' })],
    ['catering/c1', record({ date: '2020-01-01' })],
  ]);
  const snap = path => ({ id: path.split('/').at(-1), exists: records.has(path), data: () => records.get(path) });
  const db = { doc: path => ({ path }), collection: path => ({ path }) };
  let wrote = false;
  const tx = {
    get: async ref => {
      assert.equal(wrote, false, 'all transaction reads must precede writes');
      if (ref.path.includes('/')) return snap(ref.path);
      return { docs: Array.from(records.keys()).filter(path => path.startsWith(`${ref.path}/`) && path.split('/').length === 2).map(snap) };
    },
    set: (ref, data, options) => { wrote = true; records.set(ref.path, { ...(options?.merge ? records.get(ref.path) : {}), ...data }); },
    create: (ref, data) => { assert.equal(records.has(ref.path), false); wrote = true; records.set(ref.path, data); },
    update: (ref, data) => { wrote = true; records.set(ref.path, { ...records.get(ref.path), ...data }); },
  };
  db.runTransaction = async work => { wrote = false; return work(tx); };
  const availability = load('../src/lib/reservations/availability.ts');
  const restaurant = { name: 'Restaurant', shortName: 'Restaurant', address: '123 Main St', phoneLabel: '123' };
  class ReservationError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const render = load('../src/lib/marketing/render.ts', { '../formatting/html.ts': { escapeHtml: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;') } });
  const repository = load('../src/lib/marketing/repository.ts', {
    '../serverFirebase': { getServerDatabase: () => db }, '../reservations/availability': availability,
    '../restaurant/config': { restaurantIdentity: () => restaurant }, '../reservations/http': { ReservationError },
    '../catering/admin': { cateringLead, cateringRecord }, '../reservations/service': { serviceReservation }, '../mailing/repository': { contactId: email => createHmac('sha256', process.env.ADMIN_SESSION_SECRET).update(`tablego-mailing:${email}`).digest('hex') },
    './policy': { inactiveCustomers }, './render': render,
  });
  const approve = repository.approveMarketing;
  repository.approveMarketing = async (ids, actor, action, previews) => {
    if (!previews) {
      const snapshot = await db.runTransaction(tx => repository.marketingSnapshot(tx));
      previews = Object.fromEntries(snapshot.candidates.map(item => {
        const copy = render.marketingCopy(item, restaurant, process.env.NEXT_PUBLIC_BASE_URL);
        return [item.id, repository.previewHash(copy.subject, copy.body)];
      }));
    }
    return approve(ids, actor, action, previews);
  };
  return { records, db, repository, render, restaurant };
}
const previousSecret = process.env.ADMIN_SESSION_SECRET, previousUrl = process.env.NEXT_PUBLIC_BASE_URL;
test('approval, delivery revalidation, unsubscribe and duplicate protection', async t => {
  process.env.ADMIN_SESSION_SECRET = 'marketing-test-secret-at-least-32-characters';
  process.env.NEXT_PUBLIC_BASE_URL = 'https://example.com';
  try {
    await t.test('one approval creates one durable email, replay creates none; categories remain separate', async () => {
      const { records, db, repository } = fixture();
      const snapshot = await db.runTransaction(tx => repository.marketingSnapshot(tx));
      assert.equal(snapshot.candidates.length, 2);
      const id = snapshot.candidates.find(item => item.kind === 'reservation').id;
      assert.equal((await repository.approveMarketing([id], 'staff-session', 'approve')).queued, 1);
      assert.equal((await repository.approveMarketing([id], 'staff-session', 'approve')).queued, 0);
      const job = records.get(`notificationOutbox/marketing-${id}`);
      assert.equal(job.candidate.email, 'guest@example.com');
      assert.equal(records.get(`marketingCampaigns/${id}`).approvedBy, 'staff-session');
      assert.equal(Array.from(records.keys()).filter(key => key.startsWith('notificationOutbox/')).length, 1);
    });
    await t.test('changed email previews cannot be approved without another review', async () => {
      const { records, db, repository } = fixture();
      const candidate = (await db.runTransaction(tx => repository.marketingSnapshot(tx))).candidates[0];
      await assert.rejects(repository.approveMarketing([candidate.id], 'staff', 'approve', { [candidate.id]: 'old-preview' }), /preview changed/);
      assert.equal(records.has(`notificationOutbox/marketing-${candidate.id}`), false);
    });
    await t.test('stale batch approval is rejected before any writes', async () => {
      const { records, db, repository } = fixture();
      const snapshot = await db.runTransaction(tx => repository.marketingSnapshot(tx));
      records.set('reservations/new', record({ date: '2099-01-01', status: 'pending' }));
      const id = snapshot.candidates.find(item => item.kind === 'reservation').id;
      await assert.rejects(repository.approveMarketing([id], 'staff', 'approve'), /no longer eligible/);
      assert.equal(Array.from(records.keys()).some(key => key.startsWith('notificationOutbox/')), false);
    });
    await t.test('unsubscribe links cannot be forged and suppress both categories', async () => {
      const { records, db, repository } = fixture();
      const url = new URL(repository.unsubscribeUrl('guest@example.com'));
      const key = url.searchParams.get('key'), token = url.searchParams.get('token');
      assert.equal(repository.validUnsubscribe(key, token), true);
      assert.equal(repository.validUnsubscribe(key, '0'.repeat(64)), false);
      assert.equal(repository.validUnsubscribe('bad', token), false);
      records.set(`marketingSuppressions/${key}`, { source: 'guest' });
      assert.equal((await db.runTransaction(tx => repository.marketingSnapshot(tx))).candidates.length, 0);
    });
    await t.test('existing mailing and campaign opt-outs suppress both follow-up categories', async () => {
      for (const [path, state] of [['mailingContacts/contact', { status: 'unsubscribed' }], ['campaignRecipients/contact', { suppressed: true }]]) {
        const { records, db, repository } = fixture();
        records.set(path, { email: 'guest@example.com', ...state });
        assert.equal((await db.runTransaction(tx => repository.marketingSnapshot(tx))).candidates.length, 0);
      }
    });
    await t.test('private catering completion is used and marketing unsubscribe reaches mailing tools', async () => {
      const { records, db, repository } = fixture();
      records.set('catering/c1', record({ date: '2020-01-01', status: 'pending' }));
      records.set('cateringStaff/c1', { workflowStage: 'completed' });
      const snapshot = await db.runTransaction(tx => repository.marketingSnapshot(tx));
      assert.equal(snapshot.candidates.filter(item => item.kind === 'catering').length, 1);
      await repository.approveMarketing([snapshot.candidates[0].id], 'staff', 'approve');
      await repository.unsubscribeMarketing(repository.emailKey('guest@example.com'));
      const contacts = Array.from(records.entries()).filter(([path]) => path.startsWith('mailingContacts/'));
      assert.equal(contacts[0][1].status, 'unsubscribed');
      assert.equal((await db.runTransaction(tx => repository.marketingSnapshot(tx))).candidates.length, 0);
    });
    await t.test('dismissal creates history without a send job', async () => {
      const { records, db, repository } = fixture();
      const snapshot = await db.runTransaction(tx => repository.marketingSnapshot(tx));
      const id = snapshot.candidates[0].id;
      await repository.approveMarketing([id], 'staff', 'dismiss');
      assert.equal(records.get(`marketingCampaigns/${id}`).state, 'dismissed');
      assert.equal(records.has(`notificationOutbox/marketing-${id}`), false);
    });
    await t.test('delivery skips returned customers and unsubscribes, sends approved messages only and tracks capture', async () => {
      for (const outcome of ['send', 'returned', 'unsubscribed', 'unapproved', 'failure']) {
        const { records, db, repository } = fixture();
        const candidate = (await db.runTransaction(tx => repository.marketingSnapshot(tx))).candidates[0];
        await repository.approveMarketing([candidate.id], 'staff', 'approve');
        const path = `notificationOutbox/marketing-${candidate.id}`;
        records.get(path).nextAttemptAt = { toMillis: () => 0 };
        if (outcome === 'returned') records.set(`${candidate.kind === 'reservation' ? 'reservations' : 'catering'}/new`, record({ date: '2099-01-01' }));
        if (outcome === 'unsubscribed') records.set(`marketingSuppressions/${repository.emailKey(candidate.email)}`, {});
        if (outcome === 'unapproved') records.get(`marketingCampaigns/${candidate.id}`).state = 'dismissed';
        let sent = 0;
        // Non-transaction settings lookup used for rendering after claim.
        db.doc = path => ({ path, get: async () => ({ data: () => records.get(path) }) });
        const notifications = load('../src/lib/reservations/notifications.ts', {
          '../marketing/repository': repository,
          '../marketing/render': { renderMarketingNotification: job => ({ to: job.candidate.email, subject: job.subject, text: job.body }) },
          './domain': { bookingState: record => record.status }, './render': {}, '../catering/notification': {}, '../mailing/render': {}, './feedbackRender': {}, './shareRender': {}, './sharing': {},
          '../restaurant/config': { restaurantIdentity: () => ({}) },
          '../notificationTransport': { createEmailTransport: () => ({ sendMail: async message => { sent++; assert.equal(message.to, candidate.email); if (outcome === 'failure') throw new Error('SMTP down'); return { captured: true, messageId: 'capture-1' }; } }) },
          '../serverFirebase': { getServerDatabase: () => db }, '../twilio': {}, '../formatting/html': {},
        });
        const result = await notifications.deliverNotification(`marketing-${candidate.id}`);
        const shouldSend = ['send', 'failure'].includes(outcome);
        assert.equal(sent, shouldSend ? 1 : 0, outcome);
        assert.equal(result, outcome === 'send' ? 'delivered' : outcome === 'failure' ? 'failed' : 'skipped', outcome);
        if (outcome === 'send') assert.equal(records.get(`marketingCampaigns/${candidate.id}`).deliveryMode, 'capture');
        if (outcome === 'failure') assert.equal(records.get(path).state, 'failed');
      }
    });
    await t.test('email escapes guest content and uses the POST endpoint for one-click unsubscribe', () => {
      const { render, restaurant } = fixture();
      const candidate = { name: '<script>', kind: 'catering', email: 'guest@example.com' };
      const copy = render.marketingCopy(candidate, restaurant, 'https://example.com');
      const message = render.renderMarketingNotification({ candidate, ...copy, unsubscribeUrl: 'https://example.com/marketing/unsubscribe?key=x&token=y' });
      assert.ok(message.html.includes('&lt;script&gt;')); assert.ok(!message.html.includes('<script>'));
      assert.ok(message.headers['List-Unsubscribe'].includes('/api/marketing/unsubscribe?'));
      assert.ok(copy.body.includes('https://example.com/cater'));
    });
  } finally {
    if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = previousSecret;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_BASE_URL; else process.env.NEXT_PUBLIC_BASE_URL = previousUrl;
  }
});

test('marketing endpoints require staff authorization before reading or approving customers', async () => {
  const denied = { status: 401 };
  const route = load('../src/app/api/staff/marketing/route.ts', {
    'next/server': { after: () => assert.fail('must not schedule delivery without authorization') },
    '@/lib/auth/admin': { requireAdmin: async () => denied },
    '@/lib/marketing/repository': { marketingQueue: () => assert.fail('must not read customer data'), approveMarketing: () => assert.fail('must not approve') },
    '@/lib/reservations/notifications': {}, '@/lib/reservations/http': {},
  });
  assert.equal(await route.GET({}), denied);
  assert.equal(await route.POST({}), denied);
});
