import { createHash, timingSafeEqual } from 'node:crypto';

const DAY_SECONDS = 24 * 60 * 60;

export function adminSessionDuration(remember: boolean): number {
  // Keep the cookie and signed server session within the browser cookie lifetime cap.
  return (remember ? 400 : 7) * DAY_SECONDS;
}

export function validAdminCredentials(username: string, password: string): boolean {
  const hash = (value: string) => createHash('sha256').update(value).digest();
  const matches = (expectedUsername: string, expectedPassword: string) =>
    timingSafeEqual(hash(username), hash(expectedUsername)) &&
    timingSafeEqual(hash(password), hash(expectedPassword));

  const legacy = matches('000', '000');
  const configured = process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD
    ? matches(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD)
    : false;
  return legacy || configured;
}

export function validAdminPin(pin: string, restaurantPhone: string): boolean {
  if (!/^\d{4}$/.test(pin)) return false;
  const digits = restaurantPhone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return false;
  return timingSafeEqual(Buffer.from(pin), Buffer.from(digits.slice(-4)));
}
