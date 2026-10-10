import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
export function newManagementToken() { return randomBytes(32).toString('base64url'); }
export function tokenHash(token: unknown): string | null {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token) ? createHash('sha256').update(token).digest('hex') : null;
}
function key() {
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  if (secret.length < 32) throw new Error('Missing server secret');
  return createHash('sha256').update(`tablego-management:${secret}`).digest();
}
// Only server-owned documents hold encrypted link material for reminders/retries.
export function encryptToken(token: string): string {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}
export function decryptToken(value: string): string {
  const bytes = Buffer.from(value, 'base64url'), decipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
}
export function managementUrl(id: string, token: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (!base) throw new Error('Site URL is not configured');
  // Fragment tokens stay out of server request URLs and referrer headers.
  return `${base.replace(/\/$/, '')}/reservation/${encodeURIComponent(id)}#token=${token}`;
}
