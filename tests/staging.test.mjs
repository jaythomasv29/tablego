import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { stagingEnvironment, STAGING_PROJECT } from '../scripts/staging.mjs';
import { createEmailTransport } from '../src/lib/notificationTransport.ts';

test('staging refuses the production project', () => {
  assert.throws(() => stagingEnvironment({ NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'tablego-1d712' }, {}));
});

test('staging removes inherited provider and database credentials and forces capture', () => {
  const env = stagingEnvironment({ NEXT_PUBLIC_FIREBASE_PROJECT_ID: STAGING_PROJECT }, {
    FIREBASE_SERVICE_ACCOUNT_JSON: 'live-key', NEXT_PUBLIC_FIREBASE_API_KEY: 'live-public-config',
    TWILIO_AUTH_TOKEN: 'live-token', EMAIL_PASS: 'live-password', ADMIN_SESSION_SECRET: 'live-secret',
    GOOGLE_APPLICATION_CREDENTIALS: 'live-key.json', CRON_SECRET: 'live-worker-secret', PATH: '/bin', TABLEGO_NOTIFICATION_MODE: 'live',
  });
  assert.equal(env.TABLEGO_NOTIFICATION_MODE, 'capture');
  for (const name of ['FIREBASE_SERVICE_ACCOUNT_JSON', 'NEXT_PUBLIC_FIREBASE_API_KEY', 'TWILIO_AUTH_TOKEN', 'EMAIL_PASS', 'ADMIN_SESSION_SECRET', 'GOOGLE_APPLICATION_CREDENTIALS', 'CRON_SECRET']) {
    assert.equal(env[name], '');
  }
  assert.equal(env.PATH, '/bin');
});
test('staging blocks credentials absent from its config from falling back to live dotenv files', () => {
  const env = stagingEnvironment({ NEXT_PUBLIC_FIREBASE_PROJECT_ID: STAGING_PROJECT }, {}, ['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'TWILIO_API_KEY']);
  assert.equal(env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, '');
  assert.equal(env.TWILIO_API_KEY, '');
});

test('captured email and verification need no SMTP connection', async t => {
  const folder = await mkdtemp(join(tmpdir(), 'tablego-capture-'));
  const saved = {};
  for (const key of ['TABLEGO_ENVIRONMENT', 'TABLEGO_NOTIFICATION_MODE', 'TABLEGO_NOTIFICATION_CAPTURE_DIR']) saved[key] = process.env[key];
  t.after(async () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await rm(folder, { recursive: true });
  });
  process.env.TABLEGO_ENVIRONMENT = 'staging';
  process.env.TABLEGO_NOTIFICATION_MODE = 'capture';
  process.env.TABLEGO_NOTIFICATION_CAPTURE_DIR = folder;
  const transport = createEmailTransport({ host: 'unreachable.invalid', port: 1 });
  assert.equal(await transport.verify(), true);
  const result = await transport.sendMail({ to: 'guest@example.invalid', subject: 'Test request', html: '<p>Pending</p>' });
  assert.equal(result.captured, true);
  const files = await readdir(folder);
  assert.equal(files.length, 1);
  const capture = JSON.parse(await readFile(join(folder, files[0]), 'utf8'));
  assert.equal(capture.channel, 'email');
  assert.equal(capture.payload.subject, 'Test request');
});
