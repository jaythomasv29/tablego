import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { issueSignedToken, verifySignedToken } from '../src/lib/auth/signedToken.ts';
import { cateringInput } from '../src/lib/catering/input.ts';

const filename = new URL('../src/app/api/send-proposal/route.ts', import.meta.url);
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const secret = 'synthetic-catering-signing-secret-for-tests';
const inquiry = { name: 'Synthetic Catering', email: 'catering@example.invalid', phone: '(650) 555-0100', date: '2026-11-15', partySize: '20', budget: '$1000', selectedDishes: [] };
class ReservationError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }

function handler() {
  const module = { exports: {} }, records = new Map(), delivered = [];
  let databaseCalls = 0, sequence = 0;
  const ref = path => ({ path, id: path.split('/').at(-1), collection: name => ({ doc: id => ref(`${path}/${name}/${id}`) }) });
  const db = {
    doc: ref, collection: name => ({ doc: () => ref(`${name}/${++sequence}`) }),
    runTransaction: async work => work({ get: async reference => ({ data: () => records.get(reference.path) }), create: (reference, data) => records.set(reference.path, data) }),
  };
  const imports = {
    '@/lib/serverFirebase': { getServerDatabase: () => { databaseCalls++; return db; } },
    '@/lib/auth/admin': { validMutationOrigin: request => !request.foreignOrigin, readCookie: request => request.proof },
    '@/lib/auth/signedToken': { verifySignedToken: (token, kind) => verifySignedToken(token, kind, secret) },
    '@/lib/auth/rateLimit': { rateLimit: async () => null },
    '@/lib/catering/input': { cateringInput },
    '@/lib/reservations/background': { scheduleDelivery: event => delivered.push(event) },
    '@/lib/reservations/http': { ReservationError, privateJson: data => ({ status: 200, data }), reservationError: error => ({ status: error.status || 503, data: { error: error.message } }) },
  };
  const require = createRequire(filename);
  runInNewContext(compiled, { module, exports: module.exports, process: { env: { TABLEGO_ENVIRONMENT: 'staging' } }, require: name => imports[name] || require(name) });
  return { records, delivered, calls: () => databaseCalls, post: (proof, formData = inquiry, key = randomUUID(), foreignOrigin = false) => module.exports.POST({ proof, foreignOrigin, headers: new Headers({ 'Idempotency-Key': key }), json: async () => ({ formData }) }) };
}

test('catering rejects absent, forged, expired, wrong-kind and different-phone proofs before saving', async () => {
  const expired = await issueSignedToken('phone', { phone: '+16505550100' }, 1, secret, Date.now() - 60000);
  const staff = await issueSignedToken('admin', { phone: '+16505550100' }, 600, secret);
  const otherPhone = await issueSignedToken('phone', { phone: '+16505550101' }, 600, secret);
  for (const proof of [undefined, 'true', 'fake.proof', expired.token, staff.token, otherPhone.token]) {
    const route = handler();
    assert.equal((await route.post(proof, { ...inquiry, phoneVerified: true, phoneVerificationSource: 'server' })).status, 403);
    assert.equal(route.calls(), 0);
    assert.equal(route.records.size, 0);
    assert.equal(route.delivered.length, 0);
  }
});

test('matching server proof saves a normalized verified lead and keeps submission retries idempotent', async () => {
  const proof = await issueSignedToken('phone', { phone: '+16505550100' }, 600, secret), key = randomUUID(), route = handler();
  const first = await route.post(proof.token, { ...inquiry, phoneVerified: false, phoneVerificationSource: 'client', status: 'completed' }, key);
  assert.equal(first.status, 200);
  const lead = route.records.get(`catering/${first.data.cateringId}`);
  assert.equal(lead.phone, '+16505550100');
  assert.equal(lead.phoneVerified, true);
  assert.equal(lead.phoneVerificationSource, 'server');
  assert.equal(lead.status, 'pending');
  assert.ok(lead.phoneVerifiedAt);
  const retry = await route.post(proof.token, { ...inquiry, phone: '+1 650-555-0100' }, key);
  assert.equal(retry.status, 200);
  assert.equal(retry.data.cateringId, first.data.cateringId);
  assert.equal([...route.records.keys()].filter(key => /^catering\/[^/]+$/.test(key)).length, 1);
  assert.equal([...route.records.keys()].filter(key => key.startsWith('notificationOutbox/')).length, 2);
});

test('a matching phone proof never bypasses the mutation-origin check', async () => {
  const proof = await issueSignedToken('phone', { phone: '+16505550100' }, 600, secret), route = handler();
  assert.equal((await route.post(proof.token, inquiry, randomUUID(), true)).status, 403);
  assert.equal(route.records.size, 0);
});
