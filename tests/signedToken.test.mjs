import assert from 'node:assert/strict';
import { test } from 'node:test';
import { issueSignedToken, verifySignedToken } from '../src/lib/auth/signedToken.ts';

const secret = 'test-secret-with-at-least-thirty-two-characters';
const now = Date.parse('2026-10-10T19:00:00Z');

test('signed staff tokens preserve identity and expire at the boundary', async () => {
  const { token, claims } = await issueSignedToken('admin', { username: 'staff' }, 60, secret, now);
  assert.deepEqual(await verifySignedToken(token, 'admin', secret, now + 59_000), claims);
  assert.equal(await verifySignedToken(token, 'admin', secret, now + 60_000), null);
});

test('a forged literal company-auth=true cookie does not authenticate', async () => {
  assert.equal(await verifySignedToken('true', 'admin', secret, now), null);
});

test('phone verification proofs cannot authenticate staff', async () => {
  const { token } = await issueSignedToken('phone', { phone: '+16505550123' }, 60, secret, now);
  assert.equal(await verifySignedToken(token, 'admin', secret, now), null);
  assert.equal((await verifySignedToken(token, 'phone', secret, now)).data.phone, '+16505550123');
});

test('changing a signed identity invalidates its signature', async () => {
  const { token } = await issueSignedToken('admin', { username: 'staff' }, 60, secret, now);
  const [encoded, signature] = token.split('.');
  const claims = JSON.parse(Buffer.from(encoded, 'base64url'));
  claims.expiresAt += 86400;
  const altered = Buffer.from(JSON.stringify(claims)).toString('base64url');
  assert.equal(await verifySignedToken(`${altered}.${signature}`, 'admin', secret, now), null);
});

test('another environment secret cannot validate a session', async () => {
  const { token } = await issueSignedToken('admin', {}, 60, secret, now);
  assert.equal(await verifySignedToken(token, 'admin', secret + '-other', now), null);
});

test('malformed and oversized cookies fail closed', async () => {
  for (const token of [undefined, '', 'x.y.z', 'x.!', 'x'.repeat(4097)]) {
    assert.equal(await verifySignedToken(token, 'admin', secret, now), null);
  }
});

test('missing or short signing secrets cannot issue or verify sessions', async () => {
  await assert.rejects(issueSignedToken('admin', {}, 60, 'short', now));
  assert.equal(await verifySignedToken('anything', 'admin', '', now), null);
});
