export const CONSENT_VERSION = '2026-10-14';
export const CONSENT_TEXT = 'I’d like to receive promotional emails from Thaiphoon Restaurant. Unsubscribe anytime.';
export const SIGNUP_MESSAGE = 'Check your inbox for a confirmation email. If you’re already subscribed, you’re all set.';
export const statusLabels = { subscribed: 'Subscribed', pending: 'Awaiting confirmation', unsubscribed: 'Unsubscribed', contact: 'No marketing consent' } as const;
export type MailingStatus = keyof typeof statusLabels;
export function normalizedEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  const local = email.split('@')[0];
  return email.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email) && local.length <= 64 && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') ? email : null;
}
export function signupInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Enter your email and choose whether to subscribe.');
  const input = value as Record<string, unknown>, email = normalizedEmail(input.email);
  if (!email) throw new Error('Enter a valid email address.');
  if (input.consent !== true || input.consentVersion !== CONSENT_VERSION) throw new Error('Please select the promotional email consent checkbox.');
  if (input.source !== 'modal' && input.source !== 'banner') throw new Error('Invalid signup source.');
  if (typeof input.website !== 'string' || input.website.length > 200) throw new Error('Invalid signup.');
  return { email, source: input.source as 'modal' | 'banner', honeypot: Boolean(input.website) };
}
export interface MailingContact {
  id: string; email: string; sources: string[]; status: MailingStatus; version: number;
  requestedAt: string; confirmedAt: string; unsubscribedAt: string; consentVersion: string;
}
const iso = (value: unknown): string => {
  try {
    const date = value && typeof value === 'object' && 'toDate' in value ? (value as { toDate(): Date }).toDate() : typeof value === 'string' ? new Date(value) : value instanceof Date ? value : null;
    return date && Number.isFinite(date.getTime()) ? date.toISOString() : '';
  } catch { return ''; }
};
export function mergeContacts(reservations: Record<string, unknown>[], catering: Record<string, unknown>[], mailing: Record<string, unknown>[], idFor: (email: string) => string): MailingContact[] {
  const contacts = new Map<string, MailingContact>();
  for (const [source, records] of [['Reservation', reservations], ['Catering', catering], ['Signup', mailing]] as const) {
    for (const record of records) {
      const email = normalizedEmail(record.email); if (!email) continue;
      const contact = contacts.get(email) || { id: idFor(email), email, sources: [], status: 'contact', version: 0, requestedAt: '', confirmedAt: '', unsubscribedAt: '', consentVersion: '' };
      if (source !== 'Signup') contact.sources.push(source);
      else {
        const status = record.status;
        contact.status = status === 'unsubscribed' ? status : status === 'subscribed' && iso(record.confirmedAt) && record.consentVersion === CONSENT_VERSION ? status : 'pending';
        contact.version = Number.isInteger(record.version) ? Number(record.version) : 0;
        contact.sources.push(...(Array.isArray(record.sources) ? record.sources.filter(s => s === 'modal' || s === 'banner').map(s => s === 'modal' ? 'Promotion modal' : 'Homepage banner') : []));
        contact.requestedAt = iso(record.requestedAt); contact.confirmedAt = iso(record.confirmedAt); contact.unsubscribedAt = iso(record.unsubscribedAt);
        contact.consentVersion = typeof record.consentVersion === 'string' ? record.consentVersion : '';
      }
      contact.sources = Array.from(new Set(contact.sources)); contacts.set(email, contact);
    }
  }
  return Array.from(contacts.values()).sort((a, b) => a.email.localeCompare(b.email));
}
export function mailingCounts(contacts: MailingContact[]) {
  return contacts.reduce((counts, contact) => { counts.total++; counts[contact.status]++; return counts; }, { total: 0, subscribed: 0, pending: 0, unsubscribed: 0, contact: 0 });
}
