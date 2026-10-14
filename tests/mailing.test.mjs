import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as policy from '../src/lib/mailing/policy.ts';
import * as tokens from '../src/lib/reservations/managementToken.ts';
import { renderMailingConfirmation } from '../src/lib/mailing/render.ts';
import { defaultRestaurant } from '../src/lib/restaurant/config.ts';
process.env.ADMIN_SESSION_SECRET = 'synthetic-mailing-test-secret-never-used-in-production';
process.env.NEXT_PUBLIC_BASE_URL = 'https://test.example.invalid';
test('signup requires explicit current consent, validates email and preserves distinct addresses', () => {
  const input = { email: ' Guest+Offers@Example.com ', consent: true, consentVersion: policy.CONSENT_VERSION, source: 'banner', website: '' };
  assert.equal(policy.signupInput(input).email, 'guest+offers@example.com');
  for (const change of [{ consent: false }, { consentVersion: 'old' }, { email: 'bad\r\nBcc:other@example.com' }, { source: 'reservation' }]) assert.throws(() => policy.signupInput({ ...input, ...change }));
  assert.equal(policy.normalizedEmail('Guest@example.com'), 'guest@example.com');
  assert.notEqual(policy.normalizedEmail('guest+offers@example.com'), policy.normalizedEmail('guest@example.com'));
});
test('historical contacts deduplicate across sources without becoming subscribers', () => {
  const contacts = policy.mergeContacts([{ email: 'Guest@Example.com' }, { email: 'invalid' }], [{ email: 'guest@example.com' }, { email: 'second@example.com' }], [], email => email);
  assert.equal(contacts.length, 2); assert.deepEqual(contacts[0].sources, ['Reservation', 'Catering']);
  assert.deepEqual(policy.mailingCounts(contacts), { total: 2, subscribed: 0, pending: 0, unsubscribed: 0, contact: 2 });
  const approved = policy.mergeContacts([{ email: 'guest@example.com' }], [], [{ email: 'guest@example.com', status: 'subscribed', confirmedAt: '2026-10-14T12:00:00Z', consentVersion: policy.CONSENT_VERSION, sources: ['modal'] }], email => email);
  assert.equal(approved[0].status, 'subscribed'); assert.deepEqual(approved[0].sources, ['Reservation', 'Promotion modal']);
  const missingProof = policy.mergeContacts([], [], [{ email: 'guest@example.com', status: 'subscribed' }], email => email);
  assert.equal(missingProof[0].status, 'pending');
});

function repository() {
  const filename = new URL('../src/lib/mailing/repository.ts', import.meta.url), require = createRequire(filename), module = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  let now = Date.parse('2026-10-14T12:00:00Z');
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const records = new Map(), removed = Symbol('delete');
  const ref = path => ({ path, id: path.split('/').at(-1), collection: name => ({ path: `${path}/${name}`, doc: id => ref(`${path}/${name}/${id}`) }) });
  const snapshot = reference => reference.path.endsWith('/events') ? { docs: Array.from(records.keys()).filter(path => path.startsWith(reference.path + '/')).map(path => ({ ref: ref(path) })) } : ({ exists: records.has(reference.path), data: () => {
    const raw = records.get(reference.path); if (!raw) return undefined;
    return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, value instanceof Date ? { toMillis: () => value.getTime(), toDate: () => value } : value]));
  } });
  const write = (reference, data, merge = false) => {
    const result = merge ? { ...records.get(reference.path), ...data } : { ...data };
    for (const [key, value] of Object.entries(result)) if (value === removed) delete result[key];
    records.set(reference.path, result);
  };
  const db = { doc: ref, collection: name => ({ where: field => ({ limit: count => ({ get: async () => ({ docs: Array.from(records.entries()).filter(([path, value]) => path.startsWith(name + '/') && path.split('/').length === 2 && value[field]?.getTime() <= now).slice(0, count).map(([path]) => ({ id: path.split('/')[1], ref: ref(path) })) }) }) }) }),
    runTransaction: async work => work({ get: async reference => snapshot(reference), set: (reference, data, options) => write(reference, data, options?.merge), update: (reference, data) => write(reference, data, true), delete: reference => records.delete(reference.path), create: (reference, data) => { assert.ok(!records.has(reference.path)); write(reference, data); } }) };
  class ReservationError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
  const imports = { '../serverFirebase': { getServerDatabase: () => db }, '../reservations/http': { ReservationError }, '../reservations/managementToken': tokens, './policy': policy, 'firebase-admin/firestore': { FieldValue: { delete: () => removed } } };
  runInNewContext(compiled, { module, exports: module.exports, require: name => imports[name] || require(name), process, Date: Clock });
  return { api: module.exports, records, advance: milliseconds => now += milliseconds };
}
test('signup persists consent and a durable confirmation intent but never immediate marketing enrollment', async () => {
  const { api, records } = repository(), email = 'guest@example.com', event = await api.requestSignup(email, 'banner'), id = api.contactId(email);
  assert.match(id, /^[a-f0-9]{64}$/); assert.ok(!id.includes(email));
  const contact = records.get(`mailingContacts/${id}`), access = records.get(`mailingAccess/${id}`);
  assert.equal(contact.status, 'pending'); assert.equal(contact.consentText, policy.CONSENT_TEXT); assert.equal(contact.consentVersion, policy.CONSENT_VERSION);
  assert.equal(records.get(`notificationOutbox/${event}-guest`).state, 'queued');
  const token = tokens.decryptToken(access.encryptedConfirmation); assert.equal(access.confirmationHash, tokens.tokenHash(token));
  const size = records.size; assert.equal(await api.requestSignup(email, 'modal'), null); assert.equal(records.size, size);
});
test('confirmation is idempotent, unsubscribe is immediate and an old confirmation cannot undo opt-out', async () => {
  const { api, records } = repository(), email = 'guest@example.com'; await api.requestSignup(email, 'modal'); const id = api.contactId(email), access = records.get(`mailingAccess/${id}`), confirm = tokens.decryptToken(access.encryptedConfirmation), unsubscribe = tokens.decryptToken(access.encryptedUnsubscribe);
  await api.changePreference(id, confirm, 'confirm'); assert.equal(records.get(`mailingContacts/${id}`).status, 'subscribed');
  const size = records.size; await api.changePreference(id, confirm, 'confirm'); assert.equal(records.size, size);
  await api.changePreference(id, unsubscribe, 'unsubscribe'); assert.equal(records.get(`mailingContacts/${id}`).status, 'unsubscribed');
  await assert.rejects(api.changePreference(id, confirm, 'confirm'), error => error.status === 410);
  await api.changePreference(id, unsubscribe, 'unsubscribe'); assert.equal(records.get(`mailingContacts/${id}`).status, 'unsubscribed');
});
test('fresh resubscribe requires fresh confirmation and remains suppressed until confirmation', async () => {
  const { api, records, advance } = repository(), email = 'guest@example.com'; await api.requestSignup(email, 'modal'); const id = api.contactId(email);
  const old = records.get(`mailingAccess/${id}`), unsubscribe = tokens.decryptToken(old.encryptedUnsubscribe);
  await api.changePreference(id, unsubscribe, 'unsubscribe'); advance(11 * 60_000); await api.requestSignup(email, 'banner');
  assert.equal(records.get(`mailingContacts/${id}`).status, 'unsubscribed');
  const fresh = records.get(`mailingAccess/${id}`); assert.equal(fresh.unsubscribeHash, old.unsubscribeHash);
  await assert.rejects(api.changePreference(id, tokens.decryptToken(old.encryptedConfirmation), 'confirm'));
  await api.changePreference(id, unsubscribe, 'unsubscribe');
  await assert.rejects(api.changePreference(id, tokens.decryptToken(fresh.encryptedConfirmation), 'confirm'), error => error.status === 410);
  advance(11 * 60_000); await api.requestSignup(email, 'banner');
  await api.changePreference(id, tokens.decryptToken(records.get(`mailingAccess/${id}`).encryptedConfirmation), 'confirm');
  assert.equal(records.get(`mailingContacts/${id}`).status, 'subscribed');
});
test('expired and forged links cannot activate a subscriber', async () => {
  const { api, records, advance } = repository(), email = 'guest@example.com'; await api.requestSignup(email, 'banner'); const id = api.contactId(email), access = records.get(`mailingAccess/${id}`);
  await assert.rejects(api.changePreference(id, tokens.newManagementToken(), 'confirm'), error => error.status === 403);
  advance(49 * 3600_000); await assert.rejects(api.changePreference(id, tokens.decryptToken(access.encryptedConfirmation), 'confirm'), error => error.status === 410);
  await api.changePreference(id, tokens.decryptToken(access.encryptedUnsubscribe), 'unsubscribe'); assert.equal(records.get(`mailingContacts/${id}`).status, 'unsubscribed');
});
test('staff can opt out with concurrency protection but cannot enroll an address', async () => {
  const { api, records } = repository(), email = 'guest@example.com'; await api.requestSignup(email, 'banner'); const id = api.contactId(email);
  await assert.rejects(api.staffUnsubscribe(id, 99), error => error.status === 409);
  await api.staffUnsubscribe(id, 1); assert.equal(records.get(`mailingContacts/${id}`).status, 'unsubscribed');
  assert.equal(records.get(`mailingAccess/${id}`).confirmationVersion, -1);
});
test('confirmation email has a private confirmation link, permanent opt-out and postal identity without tracking pixels', () => {
  const message = renderMailingConfirmation({ entityId: 'a'.repeat(64), email: 'guest@example.com', encryptedConfirmation: tokens.encryptToken(tokens.newManagementToken()), encryptedUnsubscribe: tokens.encryptToken(tokens.newManagementToken()) }, { ...defaultRestaurant, shortName: 'Thaiphoon <safe>' });
  assert.equal(message.to, 'guest@example.com'); assert.match(message.subject, /Confirm your email/); assert.match(message.text, /48 hours/);
  assert.match(message.text, /543 Emerson St/); assert.match(message.html, /action=unsubscribe/); assert.match(message.html, /#id=/); assert.match(message.html, /Thaiphoon &lt;safe&gt;/); assert.ok(!message.html.includes('<img'));
});
test('scheduled cleanup removes expired unconfirmed data and its proof, while preserving opt-out suppression', async () => {
  const { api, records, advance } = repository();
  await api.requestSignup('pending@example.com', 'banner'); await api.requestSignup('unsubscribed@example.com', 'modal');
  const pending = api.contactId('pending@example.com'), unsubscribed = api.contactId('unsubscribed@example.com');
  await api.changePreference(unsubscribed, tokens.decryptToken(records.get(`mailingAccess/${unsubscribed}`).encryptedUnsubscribe), 'unsubscribe');
  advance(31 * 86400_000); await api.prunePendingSignups();
  assert.equal(records.has(`mailingContacts/${pending}`), false); assert.equal(records.has(`mailingAccess/${pending}`), false);
  assert.ok(!Array.from(records.keys()).some(path => path.startsWith(`mailingContacts/${pending}/events/`)));
  assert.equal(records.get(`mailingContacts/${unsubscribed}`).status, 'unsubscribed');
});
