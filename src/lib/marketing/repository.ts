import { cateringLead, cateringRecord } from '../catering/admin';
import { serviceReservation } from '../reservations/service';
import { contactId } from '../mailing/repository';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { getServerDatabase } from '../serverFirebase';
import { restaurantClock } from '../reservations/availability';
import { restaurantIdentity } from '../restaurant/config';
import { ReservationError } from '../reservations/http';
import { inactiveCustomers, type MarketingCandidate } from './policy';
import { marketingCopy } from './render';
import type { Transaction } from 'firebase-admin/firestore';

export const emailKey = (email: string) => createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
export const campaignId = (candidate: Omit<MarketingCandidate, 'id'>) => createHash('sha256').update(`${candidate.kind}:${candidate.email}:${candidate.lastDate}`).digest('hex');
export const previewHash = (subject: string, body: string) => createHash('sha256').update(JSON.stringify({ subject, body })).digest('hex');
function baseUrl() {
  const url = new URL(process.env.NEXT_PUBLIC_BASE_URL || '');
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Public base URL is required');
  return url.origin;
}
function signature(key: string) {
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  if (secret.length < 32) throw new Error('Marketing signing secret is required');
  return createHmac('sha256', secret).update(`marketing-unsubscribe:${key}`).digest('hex');
}
export function unsubscribeUrl(email: string) {
  const key = emailKey(email);
  return `${baseUrl()}/marketing/unsubscribe?key=${key}&token=${signature(key)}`;
}
export function validUnsubscribe(key: string, token: string) {
  return /^[a-f0-9]{64}$/.test(key) && /^[a-f0-9]{64}$/.test(token) && timingSafeEqual(Buffer.from(signature(key)), Buffer.from(token));
}

// Read both complete histories so a newer booking cannot be hidden by a query limit.
export async function marketingSnapshot(tx?: Transaction) {
  const db = getServerDatabase();
  const read = async (collection: string) => tx ? tx.get(db.collection(collection)) : db.collection(collection).get();
  const [reservations, catering, campaigns, suppressions, settings, cateringStaff, mailing, recipients] = await Promise.all([
    read('reservations'), read('catering'), read('marketingCampaigns'), read('marketingSuppressions'),
    tx ? tx.get(db.doc('settings/general')) : db.doc('settings/general').get(),
    read('cateringStaff'), read('mailingContacts'), read('campaignRecipients'),
  ]);
  const config = settings.data();
  if (!config?.timezone) throw new Error('Business timezone must be configured');
  const today = restaurantClock(config.timezone).date;
  const suppressed = new Set(suppressions.docs.map(doc => doc.id));
  for (const doc of [...mailing.docs, ...recipients.docs]) {
    const record = doc.data();
    if (typeof record.email === 'string' && (record.status === 'unsubscribed' || record.suppressed === true)) suppressed.add(emailKey(record.email));
  }
  const privateCatering = new Map(cateringStaff.docs.map(doc => [doc.id, doc.data()]));
  const history = campaigns.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const candidates = (['reservation', 'catering'] as const).flatMap(kind => inactiveCustomers(
    (kind === 'reservation' ? reservations : catering).docs.map(doc => {
      const raw = doc.data();
      const normalized = kind === 'catering' ? cateringLead(doc.id, cateringRecord(raw, privateCatering.get(doc.id)), config.timezone) : serviceReservation(doc.id, raw, config.timezone);
      return { ...raw, id: doc.id, date: normalized.date, status: normalized.status };
    }), kind, today))
    .map(candidate => ({ ...candidate, id: campaignId(candidate) }))
    .filter(candidate => !suppressed.has(emailKey(candidate.email)));
  return { candidates, history, restaurant: restaurantIdentity(config.restaurant), today };
}
export async function marketingQueue() {
  const snapshot = await marketingSnapshot();
  const existing = new Set(snapshot.history.map(item => item.id));
  return { today: snapshot.today,
    candidates: snapshot.candidates.filter(item => !existing.has(item.id)).map(item => { const copy = marketingCopy(item, snapshot.restaurant, baseUrl()); return { ...item, ...copy, previewHash: previewHash(copy.subject, copy.body) }; }),
    history: snapshot.history.sort((a, b) => String((b as Record<string, unknown>).approvedAt || '').localeCompare(String((a as Record<string, unknown>).approvedAt || ''))).slice(0, 200),
  };
}
export async function approveMarketing(ids: string[], actor: string, action: 'approve' | 'dismiss', previews: Record<string, string>) {
  const db = getServerDatabase();
  return db.runTransaction(async tx => {
    const snapshot = await marketingSnapshot(tx);
    const existing = new Set(snapshot.history.map(item => item.id));
    const candidates = new Map(snapshot.candidates.map(item => [item.id, item]));
    const selected = ids.map(id => {
      const candidate = candidates.get(id);
      if (!candidate && !existing.has(id)) throw new ReservationError('A selected customer is no longer eligible. Refresh the queue.', 409);
      if (candidate && !existing.has(id) && action === 'approve') {
        const copy = marketingCopy(candidate, snapshot.restaurant, baseUrl());
        if (previews[id] !== previewHash(copy.subject, copy.body)) throw new ReservationError('The email preview changed. Refresh and review it again before approving.', 409);
      }
      return candidate;
    });
    let queued = 0;
    ids.forEach((id, index) => {
      if (existing.has(id)) return; // Idempotent approval and double-click protection.
      const candidate = selected[index]!;
      const copy = marketingCopy(candidate, snapshot.restaurant, baseUrl());
      const url = unsubscribeUrl(candidate.email);
      tx.create(db.doc(`marketingCampaigns/${id}`), { candidate, ...copy, state: action === 'approve' ? 'queued' : 'dismissed', approvedBy: actor, approvedAt: new Date().toISOString() });
      if (action === 'approve') {
        tx.create(db.doc(`notificationOutbox/marketing-${id}`), { kind: 'marketing', campaignId: id, candidate, ...copy, unsubscribeUrl: url,
          channel: 'email', recipient: 'guest', state: 'queued', attempts: 0, nextAttemptAt: new Date(), createdAt: new Date() });
        queued++;
      }
    });
    return { queued };
  });
}

// A marketing opt-out also reaches the existing mailing and campaign tools.
export async function unsubscribeMarketing(key: string) {
  const db = getServerDatabase();
  await db.runTransaction(async tx => {
    const [campaigns, mailing, recipients] = await Promise.all(['marketingCampaigns', 'mailingContacts', 'campaignRecipients'].map(name => tx.get(db.collection(name))));
    const emails = [...campaigns.docs.map(doc => doc.data().candidate?.email), ...mailing.docs.map(doc => doc.data().email), ...recipients.docs.map(doc => doc.data().email)];
    const email = emails.find(value => typeof value === 'string' && emailKey(value) === key);
    let contact: FirebaseFirestore.DocumentData | undefined;
    if (email) contact = (await tx.get(db.doc(`mailingContacts/${contactId(email)}`))).data();
    tx.set(db.doc(`marketingSuppressions/${key}`), { unsubscribedAt: new Date(), source: 'guest' });
    if (email) {
      const id = contactId(email);
      tx.set(db.doc(`mailingContacts/${id}`), { email, status: 'unsubscribed', version: Number(contact?.version || 0) + 1, unsubscribedAt: new Date(), expiresAt: null }, { merge: true });
      tx.set(db.doc(`mailingAccess/${id}`), { confirmationVersion: -1 }, { merge: true });
    }
    for (const doc of recipients.docs) if (typeof doc.data().email === 'string' && emailKey(doc.data().email) === key) tx.set(db.doc(`campaignRecipients/${doc.id}`), { suppressed: true, unsubscribedAt: new Date().toISOString() }, { merge: true });
  });
}
