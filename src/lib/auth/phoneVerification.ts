import { normalizedPhone } from '../reservations/input.ts';

export function serverPhoneVerified(record: { phone?: unknown; phoneVerified?: unknown; phoneVerificationSource?: unknown }): boolean {
  if (record.phoneVerified !== true || record.phoneVerificationSource !== 'server') return false;
  try { normalizedPhone(record.phone); return true; } catch { return false; }
}
