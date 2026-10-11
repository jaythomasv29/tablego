import { liveEmailAllowed, providerTestConfig } from './providerTest.ts';
import nodemailer, { type SendMailOptions } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export function capturesNotifications(): boolean {
  if (process.env.TABLEGO_ENVIRONMENT === 'staging' && !['capture', 'provider-test'].includes(process.env.TABLEGO_NOTIFICATION_MODE || '')) {
    throw new Error('Staging requires captured notifications');
  }
  providerTestConfig(); // Invalid opt-in configuration must never enable a provider.
  return ['capture', 'provider-test'].includes(process.env.TABLEGO_NOTIFICATION_MODE || '');
}

export async function captureNotification(channel: 'email' | 'sms' | 'otp', payload: unknown): Promise<string> {
  const id = randomUUID();
  if (persistentCapture()) {
    const { getServerDatabase } = await import('./serverFirebase');
    await getServerDatabase().doc(`stagingCaptures/${id}`).create({ id, channel, capturedAt: new Date(), payload: JSON.parse(JSON.stringify(payload)) });
    return id;
  }
  const directory = process.env.TABLEGO_NOTIFICATION_CAPTURE_DIR || '.staging/outbox';
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(join(directory, `${Date.now()}-${id}.json`), JSON.stringify({
    id, channel, capturedAt: new Date().toISOString(), payload,
  }, null, 2), { mode: 0o600 });
  return id;
}

// Capture is checked for every call, before constructing any provider transport.
export function createEmailTransport(options: SMTPTransport.Options) {
  let live: ReturnType<typeof nodemailer.createTransport> | undefined;
  const getLive = () => live ??= nodemailer.createTransport(options);
  return {
    async verify(): Promise<true> {
      if (capturesNotifications()) return true;
      return getLive().verify();
    },
    async sendMail(message: SendMailOptions) {
      if (capturesNotifications() && !liveEmailAllowed(message)) {
        const messageId = await captureNotification('email', message);
        return { messageId, captured: true };
      }
      return getLive().sendMail(message);
    },
  };
}

// Vercel files are ephemeral. Hosted staging keeps synthetic captures private in
// its independent database; local fault tests continue using filesystem capture.
export function persistentCapture(): boolean {
  const enabled = process.env.VERCEL === '1' || process.env.TABLEGO_NOTIFICATION_CAPTURE_STORAGE === 'firestore';
  if (!enabled) return false;
  if (process.env.TABLEGO_ENVIRONMENT !== 'staging') {
    if (process.env.TABLEGO_NOTIFICATION_CAPTURE_STORAGE === 'firestore') throw new Error('Persistent capture is staging only');
    return false;
  }
  return true;
}
