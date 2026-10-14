import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as policy from '../src/lib/campaigns/policy.ts';
function route(path, overrides = {}) {
  const file = new URL(`../src/app/api/${path}/route.ts`, import.meta.url), require = createRequire(file), module = { exports: {} }, effects = [];
  class ReservationError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
  const imports = { 'next/server': { after: fn => effects.push(['callback', fn]) }, '@/lib/auth/admin': { requireAdmin: async r => r.foreign ? { status: 403 } : r.admin ? null : { status: 401 }, validMutationOrigin: r => !r.foreign }, '@/lib/auth/rateLimit': { rateLimit: async () => null }, '@/lib/campaigns/repository': { listCampaigns: async () => [], saveCampaign: async () => { effects.push(['save']); return 'id'; }, changeCampaign: async (...args) => effects.push(['change', ...args]), deliverCampaign: async (...args) => effects.push(['send', ...args]), unsubscribeCampaign: async token => effects.push(['unsubscribe', token]) }, '@/lib/campaigns/policy': policy, '@/lib/notificationTransport': { capturesNotifications: () => true }, '@/lib/campaigns/provider': { campaignConfiguration: () => ({ status: 'capture' }), campaignProvider: () => 'smtp', verifyWebhook: () => false }, '@/lib/campaigns/webhook': { applyCampaignWebhook: async (...args) => effects.push(['event', ...args]) }, '@/lib/reservations/http': { privateJson: (data, status = 200) => ({ data, status }), reservationError: error => ({ status: error.status || 503 }), ReservationError }, ...overrides };
  runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports, require: name => imports[name] || require(name), URL, URLSearchParams, process });
  const request = (body, flags = {}) => ({ url: 'https://test.invalid/api/campaigns/unsubscribe', headers: new Headers({ 'Content-Type': 'application/json' }), text: async () => JSON.stringify(body), ...flags });
  return { api: module.exports, effects, request };
}
test('campaign staff APIs reject anonymous and foreign requests before reads or mutations', async () => {
  const r = route('staff/campaigns');
  for (const method of ['GET', 'POST']) { assert.equal((await r.api[method](r.request({ action: 'launch' }))).status, 401); assert.equal((await r.api[method](r.request({ action: 'launch' }, { admin: true, foreign: true }))).status, 403); }
  assert.equal(r.effects.length, 0);
  assert.equal((await r.api.POST(r.request({ action: 'enroll-everyone' }, { admin: true }))).status, 400); assert.equal(r.effects.length, 0);
});
test('launch queues only its campaign; resume waits for the next daily window', async () => {
  const r = route('staff/campaigns'); await r.api.POST(r.request({ action: 'launch', id: 'own-id', version: 1 }, { admin: true }));
  assert.equal(r.effects.filter(e => e[0] === 'callback').length, 1); await r.effects.find(e => e[0] === 'callback')[1](); assert.deepEqual(r.effects.filter(e => e[0] === 'send'), [['send', 'own-id', true]]);
  const resumed = route('staff/campaigns'); await resumed.api.POST(resumed.request({ action: 'resume', id: 'own-id', version: 2 }, { admin: true })); assert.equal(resumed.effects.filter(e => e[0] === 'callback').length, 0);
});
test('unsubscribe never mutates on GET and supports both explicit preference POST and provider one-click POST', async () => {
  const r = route('campaigns/unsubscribe'); assert.equal(r.api.GET, undefined);
  assert.equal((await r.api.POST(r.request({ token: 'proof' }, { foreign: true }))).status, 403); assert.equal(r.effects.length, 0);
  assert.equal((await r.api.POST(r.request({ token: 'proof' }))).status, 200);
  assert.equal((await r.api.POST(r.request(null, { url: 'https://test.invalid/api/campaigns/unsubscribe?token=one-click-proof', headers: new Headers({ 'Content-Type': 'application/x-www-form-urlencoded' }), text: async () => 'List-Unsubscribe=One-Click' }))).status, 200);
  assert.deepEqual(r.effects, [['unsubscribe', 'proof'], ['unsubscribe', 'one-click-proof']]);
});
test('webhook rejects unsigned content before processing any event', async () => {
  const before = process.env.RESEND_WEBHOOK_SECRET; process.env.RESEND_WEBHOOK_SECRET = 'synthetic';
  try { const r = route('campaigns/webhook'); assert.equal((await r.api.POST(r.request({ type: 'email.delivered' }))).status, 401); assert.equal(r.effects.length, 0); }
  finally { if (before === undefined) delete process.env.RESEND_WEBHOOK_SECRET; else process.env.RESEND_WEBHOOK_SECRET = before; }
});
