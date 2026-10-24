import { validDate } from '../reservations/availability.ts';

export type MarketingKind = 'reservation' | 'catering';
export interface Activity { id: string; name?: unknown; email?: unknown; date?: unknown; status?: unknown; isTest?: unknown; marketingOptOut?: unknown }
export interface MarketingCandidate { id: string; kind: MarketingKind; name: string; email: string; lastDate: string; inactiveDays: number }

// Calendar days in the restaurant timezone, not elapsed browser-local hours.
export function inactiveCustomers(records: Activity[], kind: MarketingKind, today: string): Omit<MarketingCandidate, 'id'>[] {
  if (!validDate(today)) throw new Error('Invalid business date');
  const customers = new Map<string, { latest?: Activity; blocked: boolean }>();
  for (const record of records) {
    if (record.isTest === true || typeof record.email !== 'string') continue;
    const email = record.email.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) continue;
    const customer = customers.get(email) || { blocked: false };
    customers.set(email, customer);
    if (record.marketingOptOut === true) customer.blocked = true;
    if (['cancelled', 'declined', 'no-show'].includes(String(record.status))) continue;
    // Malformed historical dates require review rather than guessing eligibility.
    if (!validDate(record.date)) { customer.blocked = true; continue; }
    if (record.date >= today) customer.blocked = true;
    const qualifies = kind === 'catering' ? record.status === 'completed' : ['pending', 'confirmed', 'seated', 'completed'].includes(String(record.status));
    if (qualifies && (!customer.latest || record.date > String(customer.latest.date) ||
      (record.date === customer.latest.date && record.id > customer.latest.id))) customer.latest = record;
  }
  return Array.from(customers.entries()).flatMap(([email, customer]) => {
    if (customer.blocked || !customer.latest) return [];
    const lastDate = String(customer.latest.date);
    const inactiveDays = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${lastDate}T12:00:00Z`)) / 86400000);
    if (inactiveDays <= 30) return [];
    return [{ kind, email, name: typeof customer.latest.name === 'string' ? customer.latest.name : 'Guest', lastDate, inactiveDays }];
  }).sort((a, b) => b.inactiveDays - a.inactiveDays || a.email.localeCompare(b.email));
}
