import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as policy from '../src/lib/mailing/policy.ts';
function route(path, overrides = {}) {
  const file = new URL(`../src/app/api/${path}/route.ts`, import.meta.url), module = { exports: {} }, require = createRequire(file), effects = [];
  class ReservationError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
  const imports = {
    '@/lib/auth/admin': { requireAdmin: async request => request.foreign ? { status: 403 } : request.admin ? null : { status: 401 }, validMutationOrigin: request => !request.foreign },
    '@/lib/auth/rateLimit': { rateLimit: async (scope, identity) => { effects.push(['limit', scope, identity]); return null; } },
    '@/lib/mailing/policy': policy,
    '@/lib/mailing/repository': { requestSignup: async (...args) => { effects.push(['signup', ...args]); return 'event'; }, changePreference: async (...args) => { effects.push(['preference', ...args]); }, staffUnsubscribe: async (...args) => { effects.push(['unsubscribe', ...args]); }, loadContacts: async () => { effects.push(['load']); return { contacts: [{ email: 'synthetic@example.invalid' }], counts: { total: 1 } }; } },
    '@/lib/reservations/background': { scheduleDelivery: event => effects.push(['delivery', event]) },
    '@/lib/reservations/http': { privateJson: (data, status = 200) => ({ status, data: JSON.parse(JSON.stringify(data)) }), ReservationError, reservationError: error => ({ status: error.status || 503, data: { error: error.message } }) }, ...overrides,
  };
  runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports, require: name => imports[name] || require(name), URL, Response });
  const request = (body, flags = {}) => ({ url: 'https://test.example.invalid/api/staff/mailing', headers: new Headers(), text: async () => JSON.stringify(body), ...flags });
  return { api: module.exports, effects, request };
}
const signup = { email: 'guest@example.invalid', consent: true, consentVersion: policy.CONSENT_VERSION, source: 'modal', website: '' };
test('public signup denies foreign origins and missing consent before touching storage', async () => {
  const r = route('mailing/signup'); assert.equal((await r.api.POST(r.request(signup, { foreign: true }))).status, 403);
  assert.equal((await r.api.POST(r.request({ ...signup, consent: false }))).status, 400); assert.equal(r.effects.length, 0);
});
test('signup uses same generic response for valid requests, honeypots and email-rate limits', async () => {
  const r = route('mailing/signup'), good = await r.api.POST(r.request(signup));
  assert.equal(good.status, 200); assert.deepEqual(r.effects.filter(e => e[0] === 'delivery'), [['delivery', 'event']]);
  const bot = route('mailing/signup'); assert.deepEqual((await bot.api.POST(bot.request({ ...signup, website: 'spam' }))).data, good.data); assert.ok(!bot.effects.some(e => e[0] === 'signup'));
  const limited = route('mailing/signup', { '@/lib/auth/rateLimit': { rateLimit: async scope => scope.endsWith('-email') ? { status: 429 } : null } });
  assert.deepEqual((await limited.api.POST(limited.request(signup))).data, good.data); assert.equal(limited.effects.length, 0);
});
test('signup does not disguise infrastructure failure as a successful request', async () => {
  const r = route('mailing/signup', { '@/lib/auth/rateLimit': { rateLimit: async () => ({ status: 503 }) } });
  assert.equal((await r.api.POST(r.request(signup))).status, 503); assert.equal(r.effects.length, 0);
});
test('preference links only mutate on an explicit same-origin POST with a recognized action', async () => {
  const r = route('mailing/preferences'); assert.equal(r.api.GET, undefined);
  assert.equal((await r.api.POST(r.request({ action: 'confirm' }, { foreign: true }))).status, 403);
  assert.equal((await r.api.POST(r.request({ action: 'enroll', id: 'id', token: 'token' }))).status, 400);
  assert.equal((await r.api.POST(r.request({ action: 'unsubscribe', id: 'id', token: 'token' }))).status, 200);
  assert.deepEqual(r.effects.filter(e => e[0] === 'preference'), [['preference', 'id', 'token', 'unsubscribe']]);
});
test('staff contact data is private, summary omits emails and enrollment mutations are rejected', async () => {
  const r = route('staff/mailing');
  assert.equal((await r.api.GET(r.request(null))).status, 401); assert.equal((await r.api.PATCH(r.request({}, { foreign: true, admin: true }))).status, 403); assert.equal(r.effects.length, 0);
  const summary = await r.api.GET(r.request(null, { admin: true, url: 'https://test.example.invalid/api/staff/mailing?summary=1' }));
  assert.deepEqual(summary.data, { counts: { total: 1 } });
  assert.equal((await r.api.PATCH(r.request({ action: 'subscribe', id: 'id' }, { admin: true }))).status, 400);
});
test('subscriber export excludes historical contacts and newly revoked consent and escapes spreadsheet formulas', async () => {
  const contacts = [{ id: 'active', email: '+guest@example.invalid', status: 'subscribed', version: 2, consentVersion: policy.CONSENT_VERSION, confirmedAt: '2026-10-14T12:00:00Z' }, { id: 'revoked', email: 'revoked@example.invalid', status: 'subscribed', version: 2 }, { id: 'historical', email: 'historical@example.invalid', status: 'contact' }];
  const db = { doc: path => ({ path }), getAll: async (...refs) => refs.map(ref => ({ ref, data: () => ref.path.startsWith('mailingAccess/') ? { encryptedUnsubscribe: 'encrypted' } : { status: ref.path.endsWith('/revoked') ? 'unsubscribed' : 'subscribed', version: 2 } })) };
  const r = route('staff/mailing/export', { '@/lib/mailing/repository': { loadContacts: async () => ({ contacts }) }, '@/lib/serverFirebase': { getServerDatabase: () => db }, '@/lib/mailing/render': { preferenceUrl: id => `https://test.example.invalid/mailing/preferences#id=${id}&action=unsubscribe` }, '@/lib/reservations/managementToken': { decryptToken: () => 'synthetic' } });
  assert.equal((await r.api.POST(r.request({}, { admin: false }))).status, 401);
  const response = await r.api.POST(r.request({}, { admin: true })), exported = await response.text();
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match(exported, /"'\+guest@example.invalid"/); assert.match(exported, /action=unsubscribe/); assert.ok(!exported.includes('revoked@example.invalid')); assert.ok(!exported.includes('historical@example.invalid'));
});
