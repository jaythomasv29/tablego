import nodemailer, { type SendMailOptions } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export function capturesNotifications(): boolean {
  if (process.env.TABLEGO_ENVIRONMENT === 'staging' && process.env.TABLEGO_NOTIFICATION_MODE !== 'capture') {
    throw new Error('Staging requires captured notifications');
  }
  return process.env.TABLEGO_NOTIFICATION_MODE === 'capture';
}

export async function captureNotification(channel: 'email' | 'sms' | 'otp', payload: unknown): Promise<string> {
  const id = randomUUID();
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
      if (capturesNotifications()) {
        const messageId = await captureNotification('email', message);
        return { messageId, captured: true };
      }
      return getLive().sendMail(message);
    },
  };
}
