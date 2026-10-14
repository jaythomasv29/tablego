import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import { restaurantIdentity } from '../src/lib/restaurant/config.ts';
import { renderMailingConfirmation } from '../src/lib/mailing/render.ts';
import { encryptToken, newManagementToken } from '../src/lib/reservations/managementToken.ts';
import { escapeHtml } from '../src/lib/formatting/html.ts';
process.env.ADMIN_SESSION_SECRET = 'synthetic-mail-delivery-test-secret-used-only-in-tests';
process.env.NEXT_PUBLIC_BASE_URL = 'https://test.example.invalid';
function delivery(options = {}) {
  const filename = new URL('../src/lib/reservations/notifications.ts', import.meta.url), module = { exports: {} }, require = createRequire(filename);
  const now = Date.now(), stamp = value => ({ toMillis: () => value });
  const records = new Map([
    ['notificationOutbox/qa-guest', { kind: 'mailing-confirmation', entityId: 'contact', recipient: 'guest', channel: 'email', version: 1, state: 'queued', attempts: 0, nextAttemptAt: stamp(now - 1000), ...options.job }],
    ['mailingContacts/contact', { email: 'synthetic@example.invalid', version: 1, status: 'pending', ...options.contact }],
    ['mailingAccess/contact', { confirmationExpiresAt: now + 100000, confirmationVersion: 1, encryptedConfirmation: encryptToken(newManagementToken()), encryptedUnsubscribe: encryptToken(newManagementToken()), ...options.access }],
  ]);
  const reads = [], writes = [], sent = [];
  const snapshot = path => ({ exists: records.has(path), data: () => records.get(path) });
  const ref = path => ({ path, get: async () => { reads.push(path); return snapshot(path); } });
  const write = (reference, data, merge = false) => { writes.push(reference.path); records.set(reference.path, { ...(merge ? records.get(reference.path) : {}), ...data }); };
  const db = { doc: ref, runTransaction: async work => work({ get: async reference => { reads.push(reference.path); return snapshot(reference.path); }, update: (reference, data) => write(reference, data, true), create: (reference, data) => write(reference, data) }) };
  const imports = {
    '../serverFirebase': { getServerDatabase: () => db }, '../restaurant/config': { restaurantIdentity }, '../mailing/render': { renderMailingConfirmation },
    '../notificationTransport': { createEmailTransport: () => ({ sendMail: async message => { sent.push(message); if (options.fail) throw Error('synthetic provider failure'); return { captured: true, messageId: 'synthetic-capture' }; } }) },
    './render': {}, '../formatting/html': { escapeHtml }, '../catering/notification': {}, './shareRender': {}, './feedbackRender': {}, './sharing': {}, './domain': {}, '../twilio': {},
  };
  runInNewContext(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports, require: name => imports[name] || require(name), process, Date, URL });
  return { api: module.exports, records, sent, reads, writes };
}
test('mailing confirmations use the durable mail pipeline and only write mailing history', async () => {
  const d = delivery(); assert.equal(await d.api.deliverNotification('qa-guest'), 'delivered');
  assert.equal(d.sent.length, 1); assert.equal(d.sent[0].to, 'synthetic@example.invalid');
  assert.equal(d.records.get('notificationOutbox/qa-guest').deliveryMode, 'capture');
  assert.ok(d.writes.some(path => path.startsWith('mailingContacts/contact/events/')));
  assert.ok(!d.reads.some(path => path.startsWith('reservations/')));
});
test('expired, superseded, already confirmed, and revoked confirmation jobs never send', async () => {
  for (const options of [{ contact: { status: 'subscribed' } }, { contact: { version: 2 } }, { access: { confirmationVersion: -1 } }, { access: { confirmationExpiresAt: Date.now() - 1 } }, { job: { state: 'sending', leaseUntil: { toMillis: () => Date.now() + 100000 } } }]) {
    const d = delivery(options); assert.equal(await d.api.deliverNotification('qa-guest'), 'skipped'); assert.equal(d.sent.length, 0);
  }
});
test('temporary email failure remains retryable without enrolling the pending contact', async () => {
  const d = delivery({ fail: true }); assert.equal(await d.api.deliverNotification('qa-guest'), 'failed');
  assert.equal(d.records.get('notificationOutbox/qa-guest').state, 'failed');
  assert.equal(d.records.get('mailingContacts/contact').status, 'pending');
  assert.equal(d.records.get('notificationOutbox/qa-guest').lastError, 'provider-delivery-failed');
});
