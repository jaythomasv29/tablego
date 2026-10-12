import { getLocalDateString } from '../../utils/dateUtils.ts';
import { timestampString } from '../reservations/service.ts';
import { validDate, restaurantClock } from '../reservations/availability.ts';
import { serverPhoneVerified } from '../auth/phoneVerification.ts';

export const cateringStatusLabels = { pending: 'New inquiry', contacted: 'In conversation', confirmed: 'Confirmed event', completed: 'Completed', declined: 'Not proceeding', 'needs-review': 'Needs review' } as const;
export type CateringStatus = keyof typeof cateringStatusLabels;
export type CateringFilter = 'active' | 'pending' | 'confirmed' | 'closed' | 'all';
const text = (value: unknown, limit = 2000) => typeof value === 'string' ? value.slice(0, limit) : '';
export function closedCatering(status: CateringStatus) { return status === 'completed' || status === 'declined'; }
export function cateringLead(id: string, record: Record<string, unknown>, timezone: string) {
  let date = '';
  try { date = getLocalDateString(record.date, timezone); } catch { /* Preserve an inquiry with invalid legacy details for staff review. */ }
  const stage = record.workflowStage || record.status || 'pending';
  let status: CateringStatus = typeof stage === 'string' && ['pending', 'contacted', 'confirmed', 'completed', 'declined'].includes(stage) ? stage as CateringStatus : 'needs-review';
  // Older admin clients only know pending/completed. Honor their completion action.
  if (record.status === 'completed' && !closedCatering(status)) status = 'completed';
  const selectedDishes = Array.isArray(record.selectedDishes) ? record.selectedDishes.slice(0, 30).flatMap(dish => {
    const name = typeof dish === 'string' ? dish : dish && typeof dish === 'object' ? dish.name || dish.id : '';
    return typeof name === 'string' && name.trim() ? [name.trim().slice(0, 120)] : [];
  }) : [];
  return { id, name: text(record.name, 120) || 'Guest name missing', email: text(record.email, 254), phone: text(record.phone, 40), phoneVerified: serverPhoneVerified(record),
    date, time: text(record.time, 30), partySize: text(record.partySize, 30) || (typeof record.partySize === 'number' && Number.isFinite(record.partySize) ? String(record.partySize) : '') || (typeof record.guests === 'number' || typeof record.guests === 'string' ? String(record.guests).slice(0, 30) : ''),
    budget: text(record.budget, 100), eventType: text(record.eventType, 100), address: text(record.address, 500),
    specialRequests: text(record.specialRequests).trim() || text(record.message), selectedDishes, status,
    needsReview: !date || status === 'needs-review', internalNotes: text(record.internalNotes),
    followUpDate: validDate(record.followUpDate) ? record.followUpDate : '', createdAt: timestampString(record.createdAt), updatedAt: timestampString(record.updatedAt),
    version: Number.isInteger(record.version) && Number(record.version) > 0 ? Number(record.version) : 1 };
}
export type CateringLead = ReturnType<typeof cateringLead>;
export function cateringRecord(guest: Record<string, unknown>, staff: Record<string, unknown> = {}) {
  // Guest-facing legacy records must never supply fields presented as private staff work.
  return { ...guest, workflowStage: staff.workflowStage, internalNotes: staff.internalNotes || '', followUpDate: staff.followUpDate || '', version: staff.version || 1, updatedAt: staff.updatedAt || guest.updatedAt };
}
export function cateringUpdate(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Inquiry updates are required.');
  const body = value as Record<string, unknown>;
  if (!Number.isInteger(body.version) || Number(body.version) < 1) throw new Error('Reload this inquiry before saving.');
  if (typeof body.originalStatus !== 'string' || !Object.hasOwn(cateringStatusLabels, body.originalStatus)) throw new Error('Reload this inquiry before saving.');
  if (typeof body.status !== 'string' || !['pending', 'contacted', 'confirmed', 'completed', 'declined'].includes(body.status)) throw new Error('Choose a valid inquiry stage.');
  if (typeof body.internalNotes !== 'string' || body.internalNotes.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body.internalNotes)) throw new Error('Staff notes must be 2,000 characters or fewer.');
  if (typeof body.followUpDate !== 'string' || (body.followUpDate !== '' && !validDate(body.followUpDate))) throw new Error('Choose a valid follow-up date.');
  const status = body.status as CateringStatus;
  return { version: Number(body.version), originalStatus: body.originalStatus, status, internalNotes: body.internalNotes.trim(), followUpDate: closedCatering(status) ? '' : body.followUpDate };
}
export function cateringFollowUpDue(lead: Pick<CateringLead, 'status' | 'followUpDate'>, timezone: string, now = new Date()) {
  return !closedCatering(lead.status) && Boolean(lead.followUpDate && lead.followUpDate <= restaurantClock(timezone, now).date);
}
export function filterCatering(leads: CateringLead[], options: { filter: CateringFilter; search: string; dueOnly: boolean; sort: 'newest' | 'event' }, timezone: string, now = new Date()) {
  const search = options.search.trim().toLowerCase();
  return leads.filter(lead => {
    const stage = options.filter === 'all' || (options.filter === 'active' ? !closedCatering(lead.status) : options.filter === 'closed' ? closedCatering(lead.status) : lead.status === options.filter);
    return stage && (!options.dueOnly || cateringFollowUpDue(lead, timezone, now)) && (!search || [lead.name, lead.email, lead.phone, lead.eventType, lead.address, lead.specialRequests, ...lead.selectedDishes].join(' ').toLowerCase().includes(search));
  }).sort((a, b) => {
    if (options.sort === 'event') {
      const today = restaurantClock(timezone, now).date;
      const rank = (lead: CateringLead) => !lead.date ? 2 : lead.date < today ? 1 : 0;
      const byEvent = rank(a) - rank(b) || (a.date || '9999').localeCompare(b.date || '9999');
      if (byEvent) return byEvent;
    }
    return (b.createdAt || '').localeCompare(a.createdAt || '') || a.id.localeCompare(b.id);
  });
}
export function cateringEmailLink(lead: Pick<CateringLead, 'email' | 'date' | 'name'>, restaurantName: string) {
  if (!/^[^\s@<>,;?&#]+@[^\s@<>,;?&#]+\.[^\s@<>,;?&#]+$/.test(lead.email)) return null;
  const query = new URLSearchParams({ subject: `${restaurantName} catering${lead.date ? ` · ${lead.date}` : ''}`, body: `Hi ${lead.name},\n\nThank you for your catering inquiry.\n\n` });
  return `mailto:${lead.email}?${query.toString()}`;
}
