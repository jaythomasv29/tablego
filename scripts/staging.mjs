import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';

export const STAGING_PROJECT = 'tablego-staging-1d712';

const credentialName = /^(FIREBASE_|NEXT_PUBLIC_FIREBASE_|TWILIO_|SMTP_|EMAIL_|ADMIN_|GOOGLE_APPLICATION_CREDENTIALS$|CRON_SECRET$)/;
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
    const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', command,
      ...(command === 'build' ? [] : ['--hostname', '127.0.0.1', '--port', '3100'])], { env, stdio: 'inherit' });
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
    child.on('exit', code => { process.exitCode = code ?? 1; });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
