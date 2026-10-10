import twilio from 'twilio';
import { randomInt, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { captureNotification, capturesNotifications, persistentCapture } from './notificationTransport';

let live: ReturnType<typeof twilio> | undefined;
const getLive = () => live ??= twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN, { timeout: 15000 });

export function toE164(phone: string): string {
  if (typeof phone !== 'string') throw new Error('Invalid phone number');
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length !== 10) throw new Error('Invalid US phone number');
  return `+1${digits}`;
}

function challengePath(phone: string) {
  const dir = join(process.env.TABLEGO_NOTIFICATION_CAPTURE_DIR || '.staging/outbox', '..', 'otp');
  return { dir, file: join(dir, `${createHash('sha256').update(phone).digest('hex')}.json`) };
}

export async function sendVerificationCode(phone: string) {
  if (capturesNotifications()) {
    if (process.env.TABLEGO_ENVIRONMENT !== 'staging') throw new Error('Captured OTP is restricted to staging');
    const code = String(randomInt(1000, 10000));
    if (persistentCapture()) {
      const { getServerDatabase } = await import('./serverFirebase');
      await getServerDatabase().doc(`stagingOtpChallenges/${createHash('sha256').update(phone).digest('hex')}`).set({ code, expiresAt: Date.now() + 600_000, attempts: 0 });
      await captureNotification('otp', { to: phone, code });
      return;
    }
    const path = challengePath(phone);
    await mkdir(path.dir, { recursive: true, mode: 0o700 });
    await writeFile(path.file, JSON.stringify({ code, expiresAt: Date.now() + 600_000, attempts: 0 }), { mode: 0o600 });
    await captureNotification('otp', { to: phone, code });
    return;
  }
  await getLive().verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID!).verifications.create({ to: phone, channel: 'sms' });
}

export async function verifyPhoneCode(phone: string, code: string): Promise<boolean> {
  if (capturesNotifications()) {
    if (process.env.TABLEGO_ENVIRONMENT !== 'staging') throw new Error('Captured OTP is restricted to staging');
    if (persistentCapture()) {
      const { getServerDatabase } = await import('./serverFirebase');
      const db = getServerDatabase(), ref = db.doc(`stagingOtpChallenges/${createHash('sha256').update(phone).digest('hex')}`);
      return db.runTransaction(async tx => {
        const challenge = (await tx.get(ref)).data();
        if (!challenge || challenge.expiresAt <= Date.now() || challenge.attempts >= 5 || challenge.consumed) return false;
        if (challenge.code === code) { tx.update(ref, { consumed: true, code: null }); return true; }
        tx.update(ref, { attempts: challenge.attempts + 1 }); return false;
      });
    }
    const path = challengePath(phone);
    let challenge;
    try { challenge = JSON.parse(await readFile(path.file, 'utf8')); } catch { return false; }
    if (challenge.expiresAt <= Date.now() || challenge.attempts >= 5) return false;
    if (challenge.code === code) { await unlink(path.file); return true; }
    challenge.attempts++;
    await writeFile(path.file, JSON.stringify(challenge), { mode: 0o600 });
    return false;
  }
  const result = await getLive().verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID!).verificationChecks.create({ to: phone, code });
  return result.status === 'approved';
}

export async function sendSMS(message: { to: string; body: string }) {
  if (capturesNotifications()) return { sid: await captureNotification('sms', message), captured: true };
  return getLive().messages.create({ ...message, from: process.env.TWILIO_FROM_NUMBER });
}
