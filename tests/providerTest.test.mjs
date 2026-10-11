import assert from 'node:assert/strict';
import { test } from 'node:test';
import { providerTestConfig, liveEmailAllowed, liveOtpAllowed, providerTestTag } from '../src/lib/providerTest.ts';
import { stagingEnvironment } from '../scripts/staging.mjs';
const config = { TABLEGO_ENVIRONMENT: 'staging', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'tablego-staging-1d712', TABLEGO_NOTIFICATION_MODE: 'provider-test', TABLEGO_PROVIDER_TEST_EMAIL: 'approved@example.invalid', TABLEGO_PROVIDER_TEST_PHONE: '+16505550100', TABLEGO_PROVIDER_TEST_RUN_ID: '11111111-1111-4111-8111-111111111111' };
test('real-provider opt-in requires isolated staging and an explicit recipient', () => {
  assert.equal(providerTestConfig({}), null);
  assert.deepEqual(providerTestConfig(config), { email: config.TABLEGO_PROVIDER_TEST_EMAIL, phone: config.TABLEGO_PROVIDER_TEST_PHONE, runId: config.TABLEGO_PROVIDER_TEST_RUN_ID });
  for (const invalid of [{ TABLEGO_ENVIRONMENT: 'production' }, { NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'tablego-1d712' }, { TABLEGO_PROVIDER_TEST_EMAIL: 'a@example.invalid,b@example.invalid' }, { TABLEGO_PROVIDER_TEST_PHONE: '6505550100' }, { TABLEGO_PROVIDER_TEST_RUN_ID: '' }]) assert.throws(() => providerTestConfig({ ...config, ...invalid }));
});
test('ordinary staging clears inherited opt-in targets and still captures', () => {
  const env = stagingEnvironment({ NEXT_PUBLIC_FIREBASE_PROJECT_ID: config.NEXT_PUBLIC_FIREBASE_PROJECT_ID }, { ...config, TABLEGO_STAGING_TARGET: 'provider-test', NEXT_PUBLIC_TABLEGO_PROVIDER_TEST: 'true' });
  assert.equal(env.TABLEGO_NOTIFICATION_MODE, 'capture'); assert.equal(env.TABLEGO_PROVIDER_TEST_EMAIL, ''); assert.equal(env.TABLEGO_STAGING_TARGET, ''); assert.equal(env.NEXT_PUBLIC_TABLEGO_PROVIDER_TEST, ''); assert.equal(providerTestConfig(env), null);
});
test('only current-run guest confirmations and the approved phone can use live providers', t => {
  const saved = { ...process.env }; Object.assign(process.env, config);
  t.after(() => { for (const key of Object.keys(config)) if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; });
  const headers = { 'X-TableGo-Provider-Test-Run': config.TABLEGO_PROVIDER_TEST_RUN_ID, 'X-TableGo-Recipient': 'guest', 'X-TableGo-Status': 'confirmed', 'X-TableGo-Event': 'created' };
  const message = { to: config.TABLEGO_PROVIDER_TEST_EMAIL, headers };
  assert.equal(liveEmailAllowed(message), true);
  for (const change of [{ to: 'other@example.invalid' }, { cc: 'other@example.invalid' }, { bcc: 'other@example.invalid' }, { envelope: { to: 'other@example.invalid' } }, { headers: { ...headers, 'X-TableGo-Recipient': 'restaurant' } }, { headers: { ...headers, 'X-TableGo-Status': 'pending' } }, { headers: { ...headers, 'X-TableGo-Event': 'reminder' } }, { headers: { ...headers, 'X-TableGo-Provider-Test-Run': 'old-run' } }]) assert.equal(liveEmailAllowed({ ...message, ...change }), false);
  assert.equal(liveOtpAllowed(config.TABLEGO_PROVIDER_TEST_PHONE), true); assert.equal(liveOtpAllowed('+16505550101'), false);
  assert.equal(providerTestTag({ email: message.to, phone: config.TABLEGO_PROVIDER_TEST_PHONE }).providerTestRunId, config.TABLEGO_PROVIDER_TEST_RUN_ID);
  assert.deepEqual(providerTestTag({ email: message.to, phone: '+16505550101' }), {});
});
