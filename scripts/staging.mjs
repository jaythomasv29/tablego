import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';

export const STAGING_PROJECT = 'tablego-staging-1d712';

const credentialName = /^(TABLEGO_PROVIDER_TEST_|NEXT_PUBLIC_TABLEGO_PROVIDER_TEST$|FIREBASE_|NEXT_PUBLIC_FIREBASE_|TWILIO_|SMTP_|EMAIL_|RESEND_|CAMPAIGN_|TABLEGO_CAMPAIGN_|ADMIN_|GOOGLE_APPLICATION_CREDENTIALS$|CRON_SECRET$)/;
export function stagingEnvironment(settings, inherited = process.env, fallbackKeys = []) {
  if (settings.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== STAGING_PROJECT) {
    throw new Error(`Staging must use ${STAGING_PROJECT}`);
  }
  const env = { ...inherited };
  for (const key of [...Object.keys(env), ...fallbackKeys]) {
    if (credentialName.test(key)) {
      // Empty values prevent Next's dotenv loader from reintroducing live keys.
      env[key] = '';
    }
  }
  return {
    ...env, ...settings,
    TABLEGO_ENVIRONMENT: 'staging',
    NEXT_PUBLIC_TABLEGO_ENVIRONMENT: 'staging',
    TABLEGO_NOTIFICATION_MODE: 'capture',
    TABLEGO_STAGING_TARGET: '',
    NEXT_PUBLIC_TABLEGO_PROVIDER_TEST: '',
    TABLEGO_NOTIFICATION_CAPTURE_DIR: resolve('.staging/outbox'),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const command = process.argv[2] || 'dev';
    if (!['dev', 'build', 'start'].includes(command)) throw new Error('Use dev, build or start');
    const fallbackKeys = ['.env', '.env.local', '.env.development', '.env.development.local', '.env.production', '.env.production.local'].flatMap(file => {
      try { return Object.keys(dotenv.parse(readFileSync(file))); } catch { return []; }
    });
    const env = stagingEnvironment(dotenv.parse(readFileSync('.env.staging.local')), process.env, fallbackKeys);
    const providerTest = process.argv.includes('--provider-test');
    const qa = process.argv.includes('--qa');
    const audit = process.argv.includes('--audit');
    if ([providerTest, qa, audit].filter(Boolean).length > 1) throw new Error('Choose one staging target');
    if (providerTest) {
      const privateSettings = dotenv.parse(readFileSync('.env.provider-test.local'));
      const allowed = /^(EMAIL_USER|EMAIL_PASS|SMTP_HOST|SMTP_PORT|TWILIO_ACCOUNT_SID|TWILIO_AUTH_TOKEN|TWILIO_VERIFY_SERVICE_SID|TABLEGO_PROVIDER_TEST_EMAIL|TABLEGO_PROVIDER_TEST_PHONE|TABLEGO_PROVIDER_TEST_RUN_ID)$/;
      if (Object.keys(privateSettings).some(key => !allowed.test(key))) throw new Error('Provider test config contains unsupported keys');
      Object.assign(env, privateSettings, { TABLEGO_NOTIFICATION_MODE: 'provider-test', TABLEGO_STAGING_TARGET: 'provider-test', NEXT_PUBLIC_TABLEGO_PROVIDER_TEST: 'true', NEXT_PUBLIC_BASE_URL: 'http://127.0.0.1:3101' });
      if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(env.TABLEGO_PROVIDER_TEST_EMAIL || '') || !/^\+1\d{10}$/.test(env.TABLEGO_PROVIDER_TEST_PHONE || '') || !/^[a-f0-9-]{36}$/.test(env.TABLEGO_PROVIDER_TEST_RUN_ID || '')) throw new Error('Provider tests require approved recipients and a run ID');
      for (const key of ['EMAIL_USER', 'EMAIL_PASS', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID']) if (!env[key]) throw new Error(`Provider test credential missing: ${key}`);
    } else if (qa) Object.assign(env, { TABLEGO_STAGING_TARGET: 'qa', NEXT_PUBLIC_BASE_URL: 'http://127.0.0.1:3102' });
    else if (audit) Object.assign(env, { TABLEGO_STAGING_TARGET: 'audit', NEXT_PUBLIC_BASE_URL: 'http://127.0.0.1:3105' });
    const port = providerTest ? '3101' : qa ? '3102' : audit ? '3105' : '3100';
    const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', command,
      ...(command === 'build' ? [] : ['--hostname', '127.0.0.1', '--port', port])], { env, stdio: 'inherit' });
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
    child.on('exit', code => { process.exitCode = code ?? 1; });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
