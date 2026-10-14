// The first rollout deliberately permits one owner-authorized test recipient.
export const TEST_RECIPIENT = 'thaiphoonpaloalto@gmail.com';
export type Touchpoint = { day: number; subject: string; heading: string; body: string; cta: string; path: '/' | '/cater'; expiresOn: string };
export type CampaignInput = { name: string; touchpoints: Touchpoint[] };
export type SendState = 'pending' | 'sending' | 'accepted' | 'captured' | 'failed' | 'uncertain' | 'skipped';
export type CampaignMessage = { state: SendState; dueOn: string; updatedAt: string; detail: string; providerId?: string; attemptedAt?: string; telemetry?: Record<string, string> };
export type Campaign = CampaignInput & { id: string; provider?: 'smtp' | 'resend'; version: number; status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled'; recipient: string; timezone: string; createdAt: string; launchedAt: string; messages: CampaignMessage[] };
export function localDate(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function addDays(date: string, days: number) { return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10); }
export function recommendedCampaign(now = new Date()): CampaignInput {
  const campaign: CampaignInput = { name: 'A little more Thaiphoon · owner test', touchpoints: [
    { day: 0, subject: 'Your next lunch break, with a local perk', heading: 'A lunch break worth stepping out for.', body: 'Work nearby? Local business employees can enjoy 10% off dine-in lunch at Thaiphoon through December 12, 2026. Bring your employee badge or business card.\n\nThe offer applies to food and non-alcoholic beverages only. It excludes takeout, online orders, third-party delivery, and Happy Hour, and cannot be combined with other offers.', cta: 'Plan a lunch visit', path: '/', expiresOn: '2026-12-12' },
    { day: 7, subject: 'Make a little room for Happy Hour', heading: 'Good company. An easier afternoon.', body: 'Join us for Happy Hour every day from 4–6 PM, in Palo Alto local time. Stop by Thaiphoon on Emerson Street and ask our team about today’s Happy Hour selections.\n\nPlanning dinner afterward? Reserve a table and make an evening of it.', cta: 'Reserve a table', path: '/', expiresOn: '' },
    { day: 21, subject: 'Bring Thaiphoon to your next gathering', heading: 'Something delicious to share.', body: 'Planning an office lunch, a team get-together, or a celebration? Tell us about your gathering and our team can help with catering options.\n\nSend us your date, guest count, and what you have in mind. We’ll follow up to discuss the details.', cta: 'Explore catering', path: '/cater', expiresOn: '' },
  ] };
  if (localDate(now, 'America/Los_Angeles') > '2026-12-12') {
    campaign.touchpoints[0] = { ...campaign.touchpoints[1], day: 0 };
    campaign.touchpoints[1] = { day: 7, subject: 'Your next table on Emerson Street', heading: 'Make time for a good meal.', body: 'Catch up over lunch or settle in for dinner at Thaiphoon in downtown Palo Alto. Bring a friend, pick a date, and let us save you a table.\n\nVisit our restaurant page for the menu, current offers, and reservations.', cta: 'Plan your next visit', path: '/', expiresOn: '' };
  }
  return campaign;
}
function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value; }
export function campaignInput(value: unknown): CampaignInput {
  if (!value || typeof value !== 'object') throw new Error('Enter campaign details.');
  const input = value as Record<string, unknown>;
  const text = (v: unknown, max: number, label: string) => { if (typeof v !== 'string' || !v.trim() || v.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v)) throw new Error(`Enter a valid ${label}.`); return v.trim(); };
  const name = text(input.name, 100, 'campaign name');
  if (!Array.isArray(input.touchpoints) || input.touchpoints.length < 1 || input.touchpoints.length > 5) throw new Error('Use one to five touchpoints.');
  let previous = -7;
  const touchpoints = input.touchpoints.map((raw: unknown, index) => {
    if (!raw || typeof raw !== 'object') throw new Error('Enter touchpoint details.');
    const p = raw as Record<string, unknown>;
    if (!Number.isInteger(p.day) || Number(p.day) < 0 || Number(p.day) > 90 || (index === 0 && p.day !== 0) || Number(p.day) - previous < 7) throw new Error('Start on Day 0 and leave at least seven days between emails (maximum Day 90).');
    previous = Number(p.day);
    if (p.path !== '/' && p.path !== '/cater') throw new Error('Choose a restaurant or catering link.');
    if (typeof p.expiresOn !== 'string' || (p.expiresOn && !validDate(p.expiresOn))) throw new Error('Enter a valid offer expiry date.');
    const subject = text(p.subject, 150, 'subject');
    if (/[\r\n]/.test(subject)) throw new Error('Subjects must be a single line.');
    return { day: Number(p.day), subject, heading: text(p.heading, 150, 'heading'), body: text(p.body, 4000, 'email body'), cta: text(p.cta, 60, 'button label'), path: p.path, expiresOn: p.expiresOn } as Touchpoint;
  });
  return { name, touchpoints };
}
export function dueTouchpoint(c: Campaign, now: Date, immediate = false): number {
  if (c.status !== 'running' || c.recipient !== TEST_RECIPIENT) return -1;
  const today = localDate(now, c.timezone);
  const withinWindow = now.getUTCHours() === 18;
  return c.messages.findIndex((m, i) => m.state === 'pending' && m.dueOn <= today && (immediate && i === 0 || withinWindow));
}
export function campaignMetrics(campaigns: Campaign[]) {
  const messages = campaigns.flatMap(c => c.messages);
  return { campaigns: campaigns.length, running: campaigns.filter(c => c.status === 'running').length, delivered: messages.filter(m => m.telemetry?.delivered).length, bounced: messages.filter(m => m.telemetry?.bounced).length, complained: messages.filter(m => m.telemetry?.complained).length, opened: messages.filter(m => m.telemetry?.opened).length, clicked: messages.filter(m => m.telemetry?.clicked).length, accepted: messages.filter(m => m.state === 'accepted').length, captured: messages.filter(m => m.state === 'captured').length, pending: messages.filter(m => m.state === 'pending').length, issues: messages.filter(m => (['failed', 'uncertain'].includes(m.state) || Boolean(m.telemetry?.failed || m.telemetry?.bounced || m.telemetry?.complained || m.telemetry?.suppressed))).length };
}
