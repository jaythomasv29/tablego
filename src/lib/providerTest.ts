import type { SendMailOptions } from 'nodemailer';
// Opt-in real provider checks still use the isolated staging database. Ordinary
// staging always captures. A run tag keeps old queued fixtures from sending.
export function providerTestConfig(env: Record<string, string | undefined> = process.env) {
  if (env.TABLEGO_NOTIFICATION_MODE !== 'provider-test') return null;
  if (env.TABLEGO_ENVIRONMENT !== 'staging' || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'tablego-staging-1d712') throw new Error('Provider tests require isolated staging');
  const email = env.TABLEGO_PROVIDER_TEST_EMAIL?.trim().toLowerCase();
  const phone = env.TABLEGO_PROVIDER_TEST_PHONE;
  const runId = env.TABLEGO_PROVIDER_TEST_RUN_ID;
  if (!email || !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(email) || !phone || !/^\+1\d{10}$/.test(phone) || !runId || !/^[a-f0-9-]{36}$/.test(runId)) throw new Error('Provider tests require an explicit recipient and run ID');
  return { email, phone, runId };
}
export function providerTestTag(input: { email: string; phone: string }) {
  const config = providerTestConfig();
  return config && input.email.toLowerCase() === config.email && input.phone === config.phone ? { providerTestRunId: config.runId } : {};
}
export function liveOtpAllowed(phone: string) { return providerTestConfig()?.phone === phone; }
export function liveEmailAllowed(message: SendMailOptions) {
  const config = providerTestConfig();
  if (!config || typeof message.to !== 'string' || message.to.trim().toLowerCase() !== config.email || message.cc || message.bcc || message.envelope) return false;
  const headers = message.headers as Record<string, unknown> | undefined;
  return headers?.['X-TableGo-Provider-Test-Run'] === config.runId && headers['X-TableGo-Recipient'] === 'guest' &&
    headers['X-TableGo-Status'] === 'confirmed' && ['created', 'confirmed'].includes(String(headers['X-TableGo-Event']));
}
